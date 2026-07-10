<?php
$ports = [5432, 5433];
$passwords = ["", "postgres", "admin", "root", "123456", "password", "absen", "laragon"];
$usernames = ["postgres", "root"];

foreach ($ports as $port) {
    foreach ($usernames as $user) {
        foreach ($passwords as $pwd) {
            try {
                $dsn = "pgsql:host=127.0.0.1;port=$port;dbname=postgres";
                $pdo = new PDO($dsn, $user, $pwd, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                echo "SUCCESS: Port $port, User $user, Password '$pwd'\n";
                exit(0);
            } catch (PDOException $e) {
                // Keep trying
            }
        }
    }
}
echo "ALL COMBINATIONS FAILED\n";
exit(1);
