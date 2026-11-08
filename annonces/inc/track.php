<?php
declare(strict_types=1);
/* Mesure d'audience sans cookie ni donnée personnelle : on compte des visites par jour, jamais des personnes.
   Aucune adresse IP ni identifiant n'est conservé au-delà de la journée (empreinte salée, supprimée le lendemain). */

const IA_BOTS = ['GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'Claude-Web', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User',
    'Google-Extended', 'GoogleOther', 'Gemini', 'Bytespider', 'CCBot', 'Amazonbot', 'Applebot-Extended', 'meta-externalagent', 'cohere-ai', 'Diffbot', 'YouBot', 'DuckAssistBot',
    'MistralAI-User', 'Timpibot', 'ImagesiftBot', 'Omgilibot', 'PetalBot'];
const SRC_LABELS = ['direct' => 'Accès direct', 'newsletter' => 'Newsletter', 'facebook' => 'Facebook', 'instagram' => 'Instagram', 'tiktok' => 'TikTok',
    'moteur' => 'Moteur de recherche', 'lien' => 'Lien depuis un autre site'];

/** @return array{0:string,1:string} [nature, nom du robot] : human | ia | bot */
function track_classify_ua(string $ua): array {
    if ($ua === '') return ['bot', 'sans identifiant'];
    foreach (IA_BOTS as $b) if (stripos($ua, $b) !== false) return ['ia', $b];
    if (preg_match('/bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|skypeuripreview|slack|discord|twitter|linkedin|pinterest|embedly|vkshare|preview|curl|wget|python|java\/|go-http|okhttp|axios|node-fetch|libwww|httpclient|scrapy|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|scan|check|probe|validator|feed|fetch|archive|reader|proxy|google-|apis-google|chrome-lighthouse|bingpreview|yahoo|yandex|baidu|semrush|ahrefs|mj12|dotbot|netcraft|censys|shodan|zgrab|nmap|masscan|nuclei/i', $ua)) return ['bot', 'autre robot'];
    // un vrai navigateur envoie toujours la langue acceptée ; un robot déguisé en navigateur, rarement
    if (empty($_SERVER['HTTP_ACCEPT_LANGUAGE'])) return ['bot', 'navigateur sans langue'];
    return ['human', ''];
}

/** Famille de navigateur et de système, sans détail permettant d'identifier une personne. */
function track_ua_family(string $ua): string {
    $os = stripos($ua, 'iPhone') !== false || stripos($ua, 'iPad') !== false ? 'iOS' : (stripos($ua, 'Android') !== false ? 'Android' : (stripos($ua, 'Windows') !== false ? 'Windows' : (stripos($ua, 'Macintosh') !== false ? 'Mac' : (stripos($ua, 'Linux') !== false ? 'Linux' : 'Autre'))));
    if (preg_match('/FBAN|FBAV|FB_IAB/i', $ua)) $br = 'Facebook (appli)';
    elseif (stripos($ua, 'Instagram') !== false) $br = 'Instagram (appli)';
    elseif (preg_match('/TikTok|musical_ly|BytedanceWebview/i', $ua)) $br = 'TikTok (appli)';
    elseif (preg_match('/Edg(e|A|iOS)?\//', $ua)) $br = 'Edge';
    elseif (stripos($ua, 'OPR/') !== false) $br = 'Opera';
    elseif (preg_match('/Firefox|FxiOS/', $ua)) $br = 'Firefox';
    elseif (preg_match('/Chrome|CriOS/', $ua)) $br = 'Chrome';
    elseif (stripos($ua, 'Safari') !== false) $br = 'Safari';
    else $br = 'Autre navigateur';
    return $br . ' · ' . $os;
}

/** Origine de la visite, déduite du paramètre src/utm_source ou du site référent. @return array{0:string,1:string} [catégorie, domaine pour « lien »] */
function track_source(string $ref, array $q, string $ownHost): array {
    $p = strtolower((string)($q['src'] ?? $q['utm_source'] ?? ''));
    if ($p !== '') {
        if (in_array($p, ['newsletter', 'news', 'mail', 'email', 'brevo'], true)) return ['newsletter', ''];
        if (strpos($p, 'face') !== false || $p === 'fb') return ['facebook', ''];
        if (strpos($p, 'insta') !== false || $p === 'ig') return ['instagram', ''];
        if (strpos($p, 'tiktok') !== false) return ['tiktok', ''];
    }
    if (isset($q['fbclid'])) return ['facebook', ''];
    $host = strtolower((string)parse_url($ref, PHP_URL_HOST));
    $host = preg_replace('/^(www|m|l|lm|mobile)\./', '', $host);
    if ($host === '' || $host === $ownHost) return ['direct', ''];
    if (preg_match('/(^|\.)(facebook|fb)\.com$|^fb\.me$/', $host)) return ['facebook', ''];
    if (preg_match('/(^|\.)instagram\.com$/', $host)) return ['instagram', ''];
    if (preg_match('/(^|\.)tiktok\.com$/', $host)) return ['tiktok', ''];
    if (preg_match('/(^|\.)(google|bing|duckduckgo|qwant|ecosia|yahoo|yandex|brave|startpage|lilo|baidu)\.[a-z.]+$/', $host)) return ['moteur', ''];
    return ['lien', substr($host, 0, 80)];
}

function track_hit(string $page): void {
    // préchargement du navigateur (la page n'est pas réellement consultée) : on ne compte pas
    if (preg_match('/prefetch|prerender/i', (string)($_SERVER['HTTP_SEC_PURPOSE'] ?? $_SERVER['HTTP_PURPOSE'] ?? ''))) return;
    $pdo = db();
    $ua = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    [$kind, $bot] = track_classify_ua($ua);
    $own = strtolower(preg_replace('/^www\./', '', parse_url(SITE_URL, PHP_URL_HOST) ?: ''));
    [$src, $host] = $kind === 'human' ? track_source((string)($_SERVER['HTTP_REFERER'] ?? ''), $_GET, $own) : ['direct', ''];
    $day = date('Y-m-d');
    $up = $pdo->prepare('INSERT INTO visits (day, kind, bot, page, src, hits) VALUES (?,?,?,?,?,1) ON CONFLICT(day, kind, bot, page, src) DO UPDATE SET hits = hits + 1');
    $up->execute([$day, $kind, $bot, $page, $src]);
    if ($host !== '') $pdo->prepare('INSERT INTO ref_hosts (day, host, hits) VALUES (?,?,1) ON CONFLICT(day, host) DO UPDATE SET hits = hits + 1')->execute([$day, $host]);
    if ($kind === 'human') {   // diagnostic : navigateur/système et heure (agrégés, sans aucune donnée personnelle)
        $pdo->prepare('INSERT INTO visit_ua (day, fam, hits) VALUES (?,?,1) ON CONFLICT(day, fam) DO UPDATE SET hits = hits + 1')->execute([$day, track_ua_family($ua)]);
        $pdo->prepare('INSERT INTO visit_hours (day, hr, hits) VALUES (?,?,1) ON CONFLICT(day, hr) DO UPDATE SET hits = hits + 1')->execute([$day, (int)date('G')]);
    }
    if ($kind === 'human') {   // visiteurs distincts du jour : empreinte salée du jour, supprimée dès le lendemain
        $h = hash_hmac('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|' . $ua, APP_SECRET . $day);
        $ins = $pdo->prepare('INSERT OR IGNORE INTO seen_today (day, h) VALUES (?, ?)'); $ins->execute([$day, $h]);
        if ($ins->rowCount() === 1) $pdo->prepare('INSERT INTO uniques (day, n) VALUES (?,1) ON CONFLICT(day) DO UPDATE SET n = n + 1')->execute([$day]);
    }
    $pdo->prepare('DELETE FROM seen_today WHERE day < ?')->execute([$day]);
}
