<?php
declare(strict_types=1);
// Rédaction assistée par IA par copier-coller : aucune clé, aucun compte technique, aucune donnée personnelle envoyée.

/** Demande à coller dans un assistant (Claude). Ne contient QUE le texte public des annonces. */
function ia_prompt(array $announcements, string $issue): string {
    $mois = issue_label($issue);
    $o = "Tu es le rédacteur en chef bénévole de « Capendu en bref », la newsletter mensuelle indépendante d'un village de l'Aude. "
       . "Les lecteurs ont de 25 à 85 ans : le texte doit être simple, clair et chaleureux.\n\n"
       . "RÈGLES\n"
       . "- Phrases courtes, mots simples, ton chaleureux et neutre, vouvoiement.\n"
       . "- Garde tous les faits exacts (dates, heures, lieux, prix, conditions, noms). N'invente rien. Si une information manque, ne la complète pas.\n"
       . "- Titre : 70 caractères maximum. Texte : 450 caractères maximum, sans émoji et sans majuscules criardes.\n"
       . "- Les offres commerciales restent clairement présentées comme des offres, sans exagération.\n"
       . "- Ne change pas ce que l'annonceur propose.\n\n"
       . "FORMAT DE RÉPONSE (à respecter strictement, sans autre commentaire)\n"
       . "Pour chaque annonce, un bloc :\n### 12\nTITRE: nouveau titre\nTEXTE: nouveau texte\n\n"
       . "Termine par un bloc d'édito de 2 à 3 phrases qui ouvre le numéro de $mois en citant quelques annonces :\n### EDITO\nTEXTE: ...\n\n"
       . "ANNONCES DU NUMÉRO DE " . mb_strtoupper($mois) . "\n";
    foreach ($announcements as $a) {
        $o .= "\n### " . (int)$a['id'] . "\n"
            . 'RUBRIQUE: ' . CATEGORIES[$a['category']][1] . "\n"
            . 'TITRE: ' . $a['title'] . "\n"
            . 'TEXTE: ' . str_replace("\n", ' ', $a['what']) . "\n"
            . ($a['place'] !== '' ? 'OÙ: ' . $a['place'] . "\n" : '')
            . ($a['whenx'] !== '' ? 'QUAND: ' . $a['whenx'] . "\n" : '')
            . ($a['conditions'] !== '' ? 'CONDITIONS: ' . $a['conditions'] . "\n" : '');
    }
    return $o;
}

/** Lit la réponse de l'IA. @return array{items: array<int, array{title:string, what:string}>, edito: string} */
function ia_parse(string $reply): array {
    $reply = str_replace(["\r\n", "\r"], "\n", $reply);
    $reply = preg_replace('/\*\*|__/u', '', $reply) ?? '';
    $parts = preg_split('/^[ \t]*#{2,4}[ \t]*(\d+|EDITO|ÉDITO)[ \t]*$/miu', $reply, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [];
    if (count($parts) % 2 === 1) array_shift($parts);        // texte d'introduction de l'IA avant le premier bloc
    $items = []; $edito = '';
    for ($i = 0; $i + 1 < count($parts); $i += 2) {
        $key = trim($parts[$i]); $body = $parts[$i + 1];
        $title = preg_match('/^[ \t]*TITRE[ \t]*:[ \t]*(.+)$/mi', $body, $m) ? trim(preg_replace('/^[\s"«»]+|[\s"«»]+$/u', '', $m[1]) ?? '') : '';
        $text = preg_match('/^[ \t]*TEXTE[ \t]*:[ \t]*(.+?)(?=^[ \t]*(?:TITRE|TEXTE)[ \t]*:|\z)/msi', $body, $m) ? trim(preg_replace('/^[\s"«»]+|[\s"«»]+$/u', '', preg_replace('/\s*\n\s*/', ' ', trim($m[1])) ?? '') ?? '') : '';
        if (ctype_digit($key)) { if ($title !== '' && $text !== '') $items[(int)$key] = ['title' => one_line($title, 90), 'what' => clean($text, 700)]; }
        else $edito = clean($text, 800);
    }
    return ['items' => $items, 'edito' => $edito];
}
