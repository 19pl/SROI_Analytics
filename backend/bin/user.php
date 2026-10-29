<?php
declare(strict_types=1);

/**
 * Manage user accounts by hand. There is no self-registration, so this is the only way to create users.
 *
 *   php bin/user.php list
 *   php bin/user.php add    --email=a@nu.ac.th --name="Somchai J." [--role=viewer|editor|owner] [--org=ID] [--password=...]
 *   php bin/user.php passwd --email=a@nu.ac.th [--password=...]     (also signs the user out everywhere)
 *   php bin/user.php remove --email=a@nu.ac.th
 *
 * If --password is omitted you are prompted for it (not echoed, so it stays out of your shell history).
 * New users join the Naresuan University organization (or the one given with --org) with the chosen role;
 * the default role is "viewer".
 */
require dirname(__DIR__) . '/bootstrap.php';

use App\Core\App;

const MIN_PASSWORD = 8;
const NU_ORG_NAME = 'มหาวิทยาลัยนเรศวร (Naresuan University)';

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

function fail(string $msg): never
{
    fwrite(STDERR, "Error: $msg\n");
    exit(1);
}

/** @param list<string> $args @return array<string,string> */
function parseOptions(array $args): array
{
    $opts = [];
    foreach ($args as $a) {
        if (preg_match('/^--([a-z-]+)=(.*)$/s', $a, $m)) {
            $opts[$m[1]] = $m[2];
        } else {
            fail("Unrecognised argument '$a' (use --name=value)");
        }
    }
    return $opts;
}

function readPassword(): string
{
    $interactive = function_exists('posix_isatty') ? posix_isatty(STDIN) : true;
    $hide = $interactive && stripos(PHP_OS_FAMILY, 'Windows') === false;
    fwrite(STDOUT, 'Password (min ' . MIN_PASSWORD . ' characters): ');
    if ($hide) {
        shell_exec('stty -echo');
    }
    $p = rtrim((string)fgets(STDIN), "\r\n");
    if ($hide) {
        shell_exec('stty echo');
    }
    fwrite(STDOUT, "\n");
    return $p;
}

function checkPassword(string $p): void
{
    if (mb_strlen($p) < MIN_PASSWORD) {
        fail('Password must be at least ' . MIN_PASSWORD . ' characters.');
    }
    if (mb_strlen($p) > 200) {
        fail('Password must be at most 200 characters.');
    }
}

function normaliseEmail(?string $e): string
{
    $e = strtolower(trim((string)$e));
    if ($e === '' || filter_var($e, FILTER_VALIDATE_EMAIL) === false) {
        fail('A valid --email is required.');
    }
    return $e;
}

$app = App::fromEnv();
$db = $app->db;
$cmd = $argv[1] ?? '';
$opts = parseOptions(array_slice($argv, 2));

switch ($cmd) {
    case 'list':
        $rows = $db->all(
            'SELECT u.email, u.name, o.name AS org, m.role FROM users u
             LEFT JOIN memberships m ON m.user_id = u.id LEFT JOIN organizations o ON o.id = m.organization_id
             ORDER BY u.email'
        );
        if ($rows === []) {
            echo "No users yet. Create one with: php bin/user.php add --email=... --name=...\n";
        }
        foreach ($rows as $r) {
            printf("%-34s %-26s %-8s %s\n", $r['email'], $r['name'], $r['role'] ?? '-', $r['org'] ?? '(no organization)');
        }
        break;

    case 'add':
        $email = normaliseEmail($opts['email'] ?? null);
        $name = trim($opts['name'] ?? '');
        if ($name === '' || mb_strlen($name) > 120) {
            fail('--name is required (max 120 characters).');
        }
        $role = $opts['role'] ?? 'viewer';
        if (!in_array($role, ['viewer', 'editor', 'owner'], true)) {
            fail("--role must be viewer, editor or owner (got '$role').");
        }
        if ($db->val('SELECT 1 FROM users WHERE email = ?', [$email]) !== null) {
            fail("A user with email $email already exists. Use 'passwd' to change the password.");
        }
        if (isset($opts['org'])) {
            $org = $db->one('SELECT id, name FROM organizations WHERE id = ?', [(int)$opts['org']]);
        } else {
            $org = $db->one('SELECT id, name FROM organizations WHERE name = ?', [NU_ORG_NAME])
                ?? $db->one('SELECT id, name FROM organizations ORDER BY id LIMIT 1');
        }
        if ($org === null) {
            fail("No organization found. Run 'php bin/seed.php' first (or pass --org=ID).");
        }
        $password = $opts['password'] ?? readPassword();
        checkPassword($password);
        $db->transaction(function () use ($db, $email, $name, $password, $org, $role) {
            $uid = $db->insert('users', ['email' => $email, 'name' => $name, 'password_hash' => password_hash($password, PASSWORD_DEFAULT)]);
            $db->insert('memberships', ['organization_id' => $org['id'], 'user_id' => $uid, 'role' => $role]);
        });
        echo "Created $email as $role in \"{$org['name']}\".\n";
        break;

    case 'passwd':
        $email = normaliseEmail($opts['email'] ?? null);
        $u = $db->one('SELECT id FROM users WHERE email = ?', [$email]);
        if ($u === null) {
            fail("No user with email $email.");
        }
        $password = $opts['password'] ?? readPassword();
        checkPassword($password);
        $db->transaction(function () use ($db, $u, $password) {
            $db->update('users', (int)$u['id'], ['password_hash' => password_hash($password, PASSWORD_DEFAULT)]);
            // revoke every existing session so the old password stops working immediately
            $db->run('DELETE FROM api_tokens WHERE user_id = ?', [(int)$u['id']]);
        });
        echo "Password updated for $email. Existing sessions were signed out.\n";
        break;

    case 'remove':
        $email = normaliseEmail($opts['email'] ?? null);
        $n = $db->run('DELETE FROM users WHERE email = ?', [$email]); // memberships + tokens cascade; created_by is set to NULL
        echo $n > 0 ? "Removed $email (their projects and history are kept).\n" : "No user with email $email.\n";
        break;

    default:
        echo "Usage:\n"
            . "  php bin/user.php list\n"
            . "  php bin/user.php add    --email=a@nu.ac.th --name=\"Name\" [--role=viewer|editor|owner] [--org=ID] [--password=...]\n"
            . "  php bin/user.php passwd --email=a@nu.ac.th [--password=...]\n"
            . "  php bin/user.php remove --email=a@nu.ac.th\n";
        exit($cmd === '' ? 0 : 1);
}
