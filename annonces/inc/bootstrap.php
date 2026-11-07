<?php
declare(strict_types=1);

define('APP_ROOT', dirname(__DIR__));
$cfg = APP_ROOT . '/config.php';
if (!is_file($cfg)) { http_response_code(503); exit('Configuration manquante : copiez config.sample.php en config.php.'); }
require $cfg;
if (!defined('DATA_DIR')) define('DATA_DIR', APP_ROOT . '/data');
date_default_timezone_set('Europe/Paris');
mb_internal_encoding('UTF-8');
ini_set('display_errors', '0');

const CATEGORIES = [
    'offre'    => ['Offre',        'Bonnes affaires'],
    'sport'    => ['Sport',        'Actualité sportive'],
    'asso'     => ['Associations', 'Vie associative'],
    'sortie'   => ['Sorties',      'Fêtes et loisirs'],
    'pratique' => ['Au quotidien', 'Infos pratiques'],
];
const STATUTS = ['pending' => 'En attente', 'validated' => 'Validée', 'published' => 'Publiée', 'refused' => 'Refusée'];
const SUJETS = ['question' => 'Une question', 'donnees' => 'Mes données personnelles (accès, effacement, désinscription…)', 'aide' => 'Besoin d\'aide pour m\'inscrire ou utiliser le site', 'autre' => 'Autre'];
const MOIS = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function security_headers(bool $inlineStyles = false): void {
    header('Content-Type: text/html; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'" . ($inlineStyles ? " 'unsafe-inline'" : '')
        . "; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'");
    if (is_https()) header('Strict-Transport-Security: max-age=31536000');
}

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    if (!is_dir(DATA_DIR) && !@mkdir(DATA_DIR, 0750, true)) { http_response_code(500); exit('Dossier de données inaccessible.'); }
    $pdo = new PDO('sqlite:' . DATA_DIR . '/annonces.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    $pdo->exec("CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        category TEXT NOT NULL, title TEXT NOT NULL, what TEXT NOT NULL,
        place TEXT NOT NULL DEFAULT '', whenx TEXT NOT NULL DEFAULT '', conditions TEXT NOT NULL DEFAULT '',
        public_contact TEXT NOT NULL DEFAULT '', link_url TEXT NOT NULL DEFAULT '',
        org_name TEXT NOT NULL, contact_name TEXT NOT NULL, contact_email TEXT NOT NULL, contact_phone TEXT NOT NULL DEFAULT '',
        consent_at TEXT NOT NULL, issue TEXT NOT NULL DEFAULT '', refusal_reason TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK (id = 1), password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate (ip_hash TEXT NOT NULL, kind TEXT NOT NULL, ts INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS rate_idx ON rate (ip_hash, kind, ts);
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, subject TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
        reply_to TEXT NOT NULL DEFAULT '', message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new');
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS clicks (announcement_id INTEGER NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (announcement_id, day));
    CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);");
    return $pdo;
}

function ip_hash(): string { return hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? '0', APP_SECRET); }

function rate_count(string $kind, int $window): int {
    $st = db()->prepare('SELECT COUNT(*) FROM rate WHERE ip_hash = ? AND kind = ? AND ts > ?');
    $st->execute([ip_hash(), $kind, time() - $window]);
    return (int)$st->fetchColumn();
}
function rate_hit(string $kind): void {
    db()->prepare('INSERT INTO rate (ip_hash, kind, ts) VALUES (?, ?, ?)')->execute([ip_hash(), $kind, time()]);
    db()->prepare('DELETE FROM rate WHERE ts < ?')->execute([time() - 86400]);
}

function start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('ci_session');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => is_https(), 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
}
function csrf_token(): string {
    start_session();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="csrf" value="' . h(csrf_token()) . '">'; }
function csrf_check(): void {
    start_session();
    $ok = isset($_POST['csrf'], $_SESSION['csrf']) && hash_equals($_SESSION['csrf'], (string)$_POST['csrf']);
    if (!$ok) { http_response_code(400); exit('Session expirée ou requête invalide. Revenez en arrière et réessayez.'); }
}

// Jeton signé du formulaire public : date d'ouverture, pour refuser les robots trop rapides.
function form_stamp(): string { $t = (string)time(); return $t . '.' . hash_hmac('sha256', $t, APP_SECRET); }
function form_stamp_ok(string $s): bool {
    $p = explode('.', $s, 2);
    if (count($p) !== 2 || !ctype_digit($p[0])) return false;
    if (!hash_equals(hash_hmac('sha256', $p[0], APP_SECRET), $p[1])) return false;
    $age = time() - (int)$p[0];
    return $age >= 4 && $age <= 7200;
}

function clean(string $s, int $max): string {
    $s = preg_replace('/[^\P{C}\n]+/u', '', trim($s)) ?? '';   // retire les caractères de contrôle
    return mb_substr($s, 0, $max);
}
function one_line(string $s, int $max): string { return clean(str_replace("\n", ' ', $s), $max); }

function issue_label(string $issue): string {
    if (!preg_match('/^(\d{4})-(\d{2})$/', $issue, $m)) return '';
    return MOIS[(int)$m[2]] . ' ' . $m[1];
}
function next_issue(): string { return date('Y-m', strtotime('first day of next month')); }

function send_mail(string $to, string $subject, string $body): bool {
    if (defined('DEV_LOG_MAIL') && DEV_LOG_MAIL) { @file_put_contents(DATA_DIR . '/mail.log', "TO: $to\nSUBJECT: $subject\n$body\n----\n", FILE_APPEND); return true; }
    if (defined('MAIL_DISABLED') && MAIL_DISABLED) return false;
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $to)) return false;
    $subject = str_replace(["\r", "\n"], ' ', $subject);
    $headers = 'From: ' . SITE_NAME . ' <' . MAIL_FROM . ">"
        . "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit";
    return @mail($to, mb_encode_mimeheader($subject, 'UTF-8'), $body, $headers);
}

function bot_request(): bool {
    $ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
    if ($ua === '' || preg_match('/bot|crawl|spider|preview|prefetch|scan|monitor|curl|wget|python|headless|facebookexternalhit|slurp|mediapartners/', $ua)) return true;
    $purpose = strtolower(($_SERVER['HTTP_PURPOSE'] ?? '') . ($_SERVER['HTTP_SEC_PURPOSE'] ?? '') . ($_SERVER['HTTP_X_MOZ'] ?? ''));
    return $purpose !== '' && (str_contains($purpose, 'prefetch') || str_contains($purpose, 'preview'));
}

function safe_url(string $u): string {
    $u = trim($u);
    if ($u === '' || mb_strlen($u) > 300) return '';
    $p = parse_url($u);
    return ($p !== false && isset($p['scheme'], $p['host']) && in_array(strtolower($p['scheme']), ['http', 'https'], true)
        && filter_var($u, FILTER_VALIDATE_URL)) ? $u : '';
}

function clicks_total(int $id): int {
    $st = db()->prepare('SELECT COALESCE(SUM(n),0) FROM clicks WHERE announcement_id = ?'); $st->execute([$id]);
    return (int)$st->fetchColumn();
}
function clicks_since(int $id, int $days): int {
    $st = db()->prepare('SELECT COALESCE(SUM(n),0) FROM clicks WHERE announcement_id = ? AND day >= ?');
    $st->execute([$id, date('Y-m-d', strtotime("-$days days"))]);
    return (int)$st->fetchColumn();
}

function auto_notice(): string {
    return "\n\n---\nMessage envoyé automatiquement : merci de ne pas y répondre. Pour nous écrire, utilisez le formulaire : " . SITE_URL . '/annonces/contact.php';
}

function purge_old(): void {
    $today = date('Y-m-d');
    $st = db()->prepare("SELECT v FROM meta WHERE k = 'purge'"); $st->execute();
    if ($st->fetchColumn() === $today) return;
    $pdo = db();
    $pdo->prepare("DELETE FROM announcements WHERE status = 'refused' AND updated_at < ?")->execute([date('c', strtotime('-30 days'))]);
    $pdo->prepare("DELETE FROM announcements WHERE status = 'pending' AND created_at < ?")->execute([date('c', strtotime('-90 days'))]);
    $pdo->prepare("DELETE FROM announcements WHERE status IN ('validated','published') AND created_at < ?")->execute([date('c', strtotime('-365 days'))]);
    $pdo->prepare('DELETE FROM messages WHERE created_at < ?')->execute([date('c', strtotime('-365 days'))]);
    $pdo->exec("DELETE FROM clicks WHERE announcement_id NOT IN (SELECT id FROM announcements)");
    $pdo->prepare('DELETE FROM tokens WHERE expires < ?')->execute([time() - 86400]);
    $pdo->prepare("INSERT INTO meta (k, v) VALUES ('purge', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")->execute([$today]);
}

function page_head(string $title, string $extraCss = '', bool $noindex = false, string $base = '../'): void {
    echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . h($title) . '</title>'
        . ($noindex ? '<meta name="robots" content="noindex, nofollow">' : '')
        . '<link rel="icon" href="' . $base . 'favicon.svg" type="image/svg+xml">'
        . '<link rel="stylesheet" href="' . $base . 'styles.css">' . $extraCss . '</head><body>';
}
