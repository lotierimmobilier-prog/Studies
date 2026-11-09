<?php
declare(strict_types=1);
/* Serveur MCP minimal (Streamable HTTP, sans session) : informations publiques de Capendu en bref, en lecture seule.
   Aucun outil n'écrit ni ne renvoie de donnée personnelle : seules les informations déjà publiques du site sont exposées. */
require __DIR__ . '/inc/bootstrap.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('X-Robots-Tag: noindex');
header('Cache-Control: no-store');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if ($method !== 'POST') { http_response_code(405); header('Allow: POST, OPTIONS'); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['error' => 'Utilisez POST avec une requête JSON-RPC 2.0 (MCP). Carte du serveur : /.well-known/mcp/server-card.json']); exit; }
if (rate_count('mcp', 60) >= 60) { http_response_code(429); header('Retry-After: 60'); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32000, 'message' => 'Trop de requêtes, réessayez dans une minute.']]); exit; }
rate_hit('mcp');

const MCP_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SITE = 'https://capenduenbref.fr/';

function tools(): array {
    $none = ['type' => 'object', 'properties' => new stdClass(), 'additionalProperties' => false];
    $ro = ['readOnlyHint' => true, 'destructiveHint' => false, 'idempotentHint' => true, 'openWorldHint' => false];
    return [
        ['name' => 'get_site_info', 'title' => 'Présentation de Capendu en bref', 'description' => 'Présente Capendu en bref (newsletter locale gratuite de Capendu, Aude) et donne les adresses utiles : abonnement, devenir partenaire, liste des partenaires, contact, RGPD, histoire de Capendu.', 'inputSchema' => $none, 'annotations' => $ro],
        ['name' => 'get_publication_schedule', 'title' => 'Calendrier de la newsletter', 'description' => "Donne le rythme de la newsletter (envoi vers le 1er du mois), la date limite de dépôt des annonces (le 25 du mois précédent) et la prochaine échéance.", 'inputSchema' => $none, 'annotations' => $ro],
        ['name' => 'list_partners', 'title' => 'Entreprises et associations partenaires', 'description' => "Liste les entreprises et associations partenaires de Capendu en bref (nom, type, adresse, téléphone public) : informations déjà publiques sur le site. Filtres facultatifs.", 'inputSchema' => ['type' => 'object', 'properties' => ['type' => ['type' => 'string', 'enum' => ['entreprise', 'association'], 'description' => 'Type d\'organisation'], 'query' => ['type' => 'string', 'maxLength' => 60, 'description' => 'Texte à chercher dans le nom']], 'additionalProperties' => false], 'annotations' => $ro],
    ];
}

function text_result(array $data): array { return ['content' => [['type' => 'text', 'text' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)]], 'structuredContent' => $data, 'isError' => false]; }

function call_tool(string $name, array $args): ?array {
    switch ($name) {
        case 'get_site_info':
            return text_result([
                'nom' => 'Capendu en bref', 'langue' => 'fr', 'lieu' => 'Capendu (Aude, Occitanie, France)',
                'description' => "Newsletter mensuelle, gratuite et indépendante des entreprises et des associations de Capendu : sorties, sport, vie associative, offres signalées « Offre », retour sur les événements. Éditée bénévolement par Jérôme BOUBA, sans lien avec la mairie.",
                'contact' => 'Uniquement par formulaire (pas d\'e-mail ni d\'adresse postale publics) : ' . SITE . 'annonces/contact.php',
                'liens' => ['accueil_et_abonnement' => SITE . '#inscription', 'devenir_partenaire' => SITE . 'devenir-partenaire.html', 'liste_des_partenaires' => SITE . 'annonces/partenaires.php', 'a_propos' => SITE . 'a-propos.html', 'conditions_utilisation' => SITE . 'conditions.html', 'rgpd' => SITE . 'rgpd.html', 'histoire_de_capendu' => SITE . 'capendu-histoire.html', 'liens_utiles' => SITE . 'liens.html', 'llms_txt' => SITE . 'llms.txt'],
            ]);
        case 'get_publication_schedule':
            [$issue, $deadline] = next_deadline();
            return text_result(['envoi' => 'Tous les 1er du mois environ', 'date_limite_des_annonces' => "Le 25 du mois précédant le numéro", 'prochaine_date_limite' => $deadline, 'prochain_numero' => $issue, 'gratuit' => true, 'depot' => SITE . 'annonces/deposer.php (réservé aux partenaires validés)']);
        case 'list_partners':
            $type = (string)($args['type'] ?? ''); $q = mb_substr(trim((string)($args['query'] ?? '')), 0, 60);
            $sql = "SELECT org_name, org_type, address, postal_code, city, public_phone, eligibility, activity_place, can_help FROM partners WHERE status = 'approved'";
            $par = [];
            if (isset(ORG_TYPES[$type])) { $sql .= ' AND org_type = ?'; $par[] = $type; }
            if ($q !== '') { $sql .= " AND org_name LIKE ? ESCAPE '!'"; $par[] = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $q) . '%'; }
            $st = db()->prepare($sql . ' ORDER BY org_name COLLATE NOCASE LIMIT 100'); $st->execute($par);
            $rows = [];
            foreach ($st->fetchAll() as $r) $rows[] = ['nom' => $r['org_name'], 'type' => $r['org_type'], 'adresse' => full_address($r), 'telephone' => $r['public_phone'], 'activite_a_capendu' => $r['eligibility'] === 'voisine' ? $r['activity_place'] : null, 'aide_a_l_inscription' => (bool)$r['can_help']];
            return text_result(['nombre' => count($rows), 'partenaires' => $rows]);
    }
    return null;
}

function handle(array $m): ?array {
    $id = $m['id'] ?? null; $meth = (string)($m['method'] ?? '');
    $ok = fn($r) => ['jsonrpc' => '2.0', 'id' => $id, 'result' => $r];
    $err = fn(int $c, string $t) => ['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => $c, 'message' => $t]];
    if (!array_key_exists('id', $m)) return null;                 // notification : pas de réponse
    switch ($meth) {
        case 'initialize':
            $want = (string)($m['params']['protocolVersion'] ?? '');
            return $ok(['protocolVersion' => in_array($want, MCP_VERSIONS, true) ? $want : MCP_VERSIONS[0], 'capabilities' => ['tools' => ['listChanged' => false]],
                'serverInfo' => ['name' => 'capendu-en-bref', 'title' => 'Capendu en bref', 'version' => '1.0.0'],
                'instructions' => "Informations publiques sur Capendu en bref, la newsletter locale de Capendu (Aude). Lecture seule, aucune donnée personnelle."]);
        case 'ping': return $ok(new stdClass());
        case 'tools/list': return $ok(['tools' => tools()]);
        case 'tools/call':
            $name = (string)($m['params']['name'] ?? ''); $a = $m['params']['arguments'] ?? [];
            $r = call_tool($name, is_array($a) ? $a : []);
            return $r === null ? $err(-32602, 'Outil inconnu : ' . $name) : $ok($r);
        case 'resources/list': return $ok(['resources' => []]);
        case 'prompts/list': return $ok(['prompts' => []]);
    }
    return $err(-32601, 'Méthode non prise en charge');
}

$raw = file_get_contents('php://input', false, null, 0, 65536);
$in = json_decode((string)$raw, true);
header('Content-Type: application/json; charset=utf-8');
if (!is_array($in)) { http_response_code(400); echo json_encode(['jsonrpc' => '2.0', 'id' => null, 'error' => ['code' => -32700, 'message' => 'JSON invalide']]); exit; }
$batch = array_is_list($in) && $in !== [];
$out = [];
foreach ($batch ? $in : [$in] as $msg) { if (!is_array($msg)) continue; $r = handle($msg); if ($r !== null) $out[] = $r; }
if (!$out) { http_response_code(202); exit; }
echo json_encode($batch ? $out : $out[0], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
