<?php
declare(strict_types=1);
require __DIR__ . '/../inc/bootstrap.php';
start_session();
unset($_SESSION['partner_email'], $_SESSION['partner_seen']);
header('Location: index.php');
