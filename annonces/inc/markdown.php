<?php
declare(strict_types=1);
/* Conversion HTML → Markdown des pages publiques (pour les agents qui demandent Accept: text/markdown).
   Le contenu vient toujours de la page HTML : aucune copie à maintenir. */

function wants_markdown(string $accept): bool {
    if ($accept === '') return false;
    $md = -1.0; $html = -1.0; $any = -1.0;
    foreach (explode(',', $accept) as $part) {
        $bits = explode(';', trim($part)); $type = strtolower(trim($bits[0])); $q = 1.0;
        foreach (array_slice($bits, 1) as $b) if (preg_match('/^\s*q\s*=\s*([0-9.]+)/i', $b, $m)) $q = (float)$m[1];
        if ($type === 'text/markdown') $md = max($md, $q);
        elseif ($type === 'text/html' || $type === 'application/xhtml+xml') $html = max($html, $q);
        elseif ($type === '*/*' || $type === 'text/*') $any = max($any, $q);
    }
    if ($md <= 0) return false;
    $htmlQ = $html >= 0 ? $html : max($any, 0.0);
    return $md >= $htmlQ;
}

function md_abs(string $href, string $base): string {
    if ($href === '' ) return $base;
    if (preg_match('#^(https?:|mailto:|tel:)#i', $href)) return $href;
    if ($href[0] === '#') return $base . $href;
    $root = preg_replace('#^(https?://[^/]+/).*$#', '$1', $base);
    return $root . ltrim($href, '/');
}

function md_inline(DOMNode $n, string $base): string {
    $o = '';
    foreach ($n->childNodes as $c) {
        if ($c instanceof DOMText) { $o .= preg_replace('/\s+/u', ' ', $c->nodeValue); continue; }
        if (!($c instanceof DOMElement)) continue;
        $t = strtolower($c->tagName);
        if (in_array($t, ['script', 'style', 'svg', 'button', 'input', 'select', 'textarea', 'form', 'noscript'], true)) continue;
        $inner = md_inline($c, $base);
        switch ($t) {
            case 'a': $txt = trim($inner); $o .= $txt === '' ? '' : '[' . $txt . '](' . md_abs($c->getAttribute('href'), $base) . ')'; break;
            case 'strong': case 'b': $o .= trim($inner) === '' ? '' : '**' . trim($inner) . '**'; break;
            case 'em': case 'i': $o .= trim($inner) === '' ? '' : '*' . trim($inner) . '*'; break;
            case 'br': $o .= "  \n"; break;
            case 'sup': $o .= trim($inner) === 'er' ? 'er' : $inner; break;
            case 'img': $alt = trim($c->getAttribute('alt')); $o .= $alt !== '' ? $alt : ''; break;
            default: $o .= $inner;
        }
    }
    return $o;
}

function md_blocks(DOMNode $n, string $base, int $depth = 0): string {
    $o = '';
    foreach ($n->childNodes as $c) {
        if ($c instanceof DOMText) { $t = trim(preg_replace('/\s+/u', ' ', $c->nodeValue)); if ($t !== '') $o .= $t . "\n\n"; continue; }
        if (!($c instanceof DOMElement)) continue;
        $t = strtolower($c->tagName);
        if (in_array($t, ['script', 'style', 'svg', 'button', 'input', 'select', 'textarea', 'form', 'noscript', 'nav', 'header', 'footer', 'summary', 'details'], true)) continue;
        if (preg_match('/^h([1-6])$/', $t, $m)) { $x = trim(md_inline($c, $base)); if ($x !== '') $o .= "\n\n" . str_repeat('#', (int)$m[1]) . ' ' . $x . "\n\n"; continue; }
        if ($t === 'p') { $x = trim(md_inline($c, $base)); if ($x !== '') $o .= $x . "\n\n"; continue; }
        if ($t === 'ul' || $t === 'ol') {
            $i = 0;
            foreach ($c->childNodes as $li) {
                if (!($li instanceof DOMElement) || strtolower($li->tagName) !== 'li') continue;
                $i++; $pad = str_repeat('  ', $depth);
                $head = '';
                foreach ($li->childNodes as $ch) { if ($ch instanceof DOMElement && in_array(strtolower($ch->tagName), ['ul', 'ol'], true)) continue; $head .= $ch instanceof DOMText ? preg_replace('/\s+/u', ' ', $ch->nodeValue) : md_inline_node($ch, $base); }
                $o .= $pad . ($t === 'ol' ? $i . '. ' : '- ') . trim(preg_replace('/\s*\n\s*/u', ' ', $head)) . "\n";
                foreach ($li->childNodes as $ch) if ($ch instanceof DOMElement && in_array(strtolower($ch->tagName), ['ul', 'ol'], true)) $o .= md_blocks(new_wrapper($ch), $base, $depth + 1);
            }
            $o .= "\n"; continue;
        }
        if ($t === 'table') {
            $rows = [];
            foreach ($c->getElementsByTagName('tr') as $tr) { $cells = []; foreach ($tr->childNodes as $td) if ($td instanceof DOMElement && in_array(strtolower($td->tagName), ['td', 'th'], true)) $cells[] = str_replace('|', '\\|', trim(preg_replace('/\s+/u', ' ', md_inline($td, $base)))); if ($cells) $rows[] = $cells; }
            if ($rows) { $o .= '| ' . implode(' | ', $rows[0]) . " |\n| " . implode(' | ', array_fill(0, count($rows[0]), '---')) . " |\n"; foreach (array_slice($rows, 1) as $r) $o .= '| ' . implode(' | ', $r) . " |\n"; $o .= "\n"; }
            continue;
        }
        if ($t === 'div' && $c->getAttribute('role') === 'row') {
            $cells = []; foreach ($c->childNodes as $x) if ($x instanceof DOMElement) $cells[] = trim(md_inline($x, $base));
            if (count($cells) >= 2) $o .= '- **' . $cells[0] . '** : ' . implode(' ', array_slice($cells, 1)) . "\n"; continue;
        }
        $inner = md_blocks($c, $base, $depth);
        $o .= $inner;
        if ($t === 'div' && $c->getAttribute('role') === 'table') $o .= "\n";
    }
    return $o;
}
function md_inline_node(DOMNode $n, string $base): string { $d = new DOMDocument(); $r = $d->createElement('x'); $d->appendChild($r); $r->appendChild($d->importNode($n, true)); return md_inline($r, $base); }
function new_wrapper(DOMNode $n): DOMNode { $d = new DOMDocument(); $r = $d->createElement('x'); $d->appendChild($r); $r->appendChild($d->importNode($n, true)); return $r; }

function html_to_markdown(string $html, string $pageUrl): string {
    $d = new DOMDocument(); $prev = libxml_use_internal_errors(true);
    $d->loadHTML('<?xml encoding="utf-8" ?>' . $html); libxml_clear_errors(); libxml_use_internal_errors($prev);
    $title = ''; foreach ($d->getElementsByTagName('title') as $t) { $title = trim($t->textContent); break; }
    $desc = ''; foreach ($d->getElementsByTagName('meta') as $m) if ($m->getAttribute('name') === 'description') { $desc = trim($m->getAttribute('content')); break; }
    $main = $d->getElementsByTagName('main')->item(0) ?: $d->getElementsByTagName('body')->item(0);
    $body = $main ? md_blocks($main, $pageUrl) : '';
    $body = trim(preg_replace("/\n{3,}/", "\n\n", $body));
    return '# ' . $title . "\n\n" . ($desc !== '' ? '> ' . $desc . "\n\n" : '') . 'Source : ' . $pageUrl . "\n\n---\n\n" . $body . "\n";
}
