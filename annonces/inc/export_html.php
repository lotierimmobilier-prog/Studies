<?php
declare(strict_types=1);
// Rendu des annonces validées sous forme de blocs HTML compatibles e-mail (mêmes styles que le modèle du numéro 1).
const X_TEAL = '#12403e'; const X_SOFT = '#3a625f'; const X_WINE = '#c0455e'; const X_LINE = '#cfe6e2'; const X_BG3 = '#d5eeea';
const X_HEAD = "'Segoe UI',Arial,Helvetica,sans-serif"; const X_BODY = "'Segoe UI',Arial,Helvetica,sans-serif";

function x_tag(string $label, bool $offre): string {
    [$bg, $fg] = $offre ? ['#fbe3e8', '#a23650'] : [X_BG3, '#0b6b66'];
    return '<span style="display:inline-block;background:' . $bg . ';color:' . $fg . ';font:700 13px/1 ' . X_BODY . ';letter-spacing:.05em;text-transform:uppercase;padding:6px 12px;border-radius:6px;">' . h($label) . '</span>';
}
function x_fiche(array $a): string {
    $rows = '';
    foreach ([['Quoi', $a['what']], ['Où', $a['place']], ['Quand', $a['whenx']], ['Conditions', $a['conditions']], ['Contact', $a['public_contact']], ['Proposé par', $a['org_name']]] as [$k, $v]) {
        if ($v === '') continue;
        $rows .= '<tr><td style="padding:3px 12px 3px 0;font:700 16px/1.5 ' . X_BODY . ';color:' . X_SOFT . ';white-space:nowrap;vertical-align:top;">' . h($k) . '</td>'
               . '<td style="padding:3px 0;font:400 17px/1.5 ' . X_BODY . ';color:' . X_TEAL . ';">' . nl2br(h($v)) . '</td></tr>';
    }
    $url = SITE_URL . '/annonces/r.php?id=' . (int)$a['id'];
    $img = ($a['photo'] ?? '') !== '' ? '<img src="' . h(SITE_URL . '/annonces/photo.php?id=' . (int)$a['id']) . '" alt="' . h($a['title']) . '" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:10px;margin:0 0 12px;">' : '';
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;background:#ffffff;border:1px solid ' . X_LINE . ';border-radius:12px;"><tr><td style="padding:18px 20px;">'
        . $img . '<div style="font:700 20px/1.3 ' . X_HEAD . ';color:' . X_TEAL . ';margin-bottom:8px;">' . h($a['title']) . '</div>'
        . '<table role="presentation" cellpadding="0" cellspacing="0">' . $rows . '</table>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr><td align="center" bgcolor="' . X_WINE . '" style="border-radius:10px;">'
        . '<a href="' . h($url) . '" style="display:inline-block;padding:12px 24px;font:700 16px/1 ' . X_BODY . ';color:#ffffff;text-decoration:none;border-radius:10px;">En savoir plus</a></td></tr></table>'
        . '</td></tr></table>';
}
function x_sections(array $announcements): string {
    $out = '';
    foreach (CATEGORIES as $key => [$tag, $label]) {
        $items = array_values(array_filter($announcements, fn($a) => $a['category'] === $key));
        if (!$items) continue;
        $out .= '<tr><td style="padding:8px 24px 18px;">' . x_tag($tag, $key === 'offre')
              . '<h2 style="margin:14px 0 10px;font:700 26px/1.2 ' . X_HEAD . ';color:' . X_TEAL . ';">' . h($label) . '</h2>';
        foreach ($items as $a) $out .= x_fiche($a);
        $out .= '</td></tr>' . "\n";
    }
    return $out;
}
