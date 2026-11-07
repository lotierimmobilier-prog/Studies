<?php
declare(strict_types=1);
require __DIR__ . '/../inc/bootstrap.php';
start_session();
unset($_SESSION['admin'], $_SESSION['admin_seen']);
header('Location: login.php');
