<?php
declare(strict_types=1);

namespace App\Core;

final class Request
{
    /** @var array<string,string> */
    public array $params = [];
    /** @var array<string,mixed>|null authenticated user: id, email, name */
    public ?array $user = null;
    /** @var array<string,mixed>|null */
    private ?array $parsed = null;

    /**
     * @param array<string,mixed> $query
     * @param array<string,string> $headers lower-cased names
     * @param array<string,mixed> $files
     * @param array<string,mixed>|null $form pre-parsed multipart/form fields
     */
    public function __construct(
        public string $method,
        public string $path,
        public array $query = [],
        public array $headers = [],
        private ?string $rawBody = null,
        public array $files = [],
        public string $ip = '0.0.0.0',
        private ?array $form = null,
    ) {
        $this->method = strtoupper($method);
        $this->path = '/' . trim($path, '/');
    }

    public static function fromGlobals(int $maxBody): self
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (str_starts_with($k, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = (string)$v;
            }
        }
        foreach (['CONTENT_TYPE' => 'content-type', 'CONTENT_LENGTH' => 'content-length'] as $s => $h) {
            if (isset($_SERVER[$s])) {
                $headers[$h] = (string)$_SERVER[$s];
            }
        }
        if ((int)($headers['content-length'] ?? 0) > $maxBody && !str_contains($headers['content-type'] ?? '', 'multipart/')) {
            throw new HttpException(413, 'Request body too large', 'payload_too_large');
        }
        $multipart = str_contains($headers['content-type'] ?? '', 'multipart/form-data');
        $raw = $multipart ? null : (string)file_get_contents('php://input', false, null, 0, $maxBody + 1);
        if ($raw !== null && strlen($raw) > $maxBody) {
            throw new HttpException(413, 'Request body too large', 'payload_too_large');
        }
        return new self(
            $_SERVER['REQUEST_METHOD'] ?? 'GET',
            $path,
            $_GET,
            $headers,
            $raw,
            $_FILES,
            $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
            $multipart ? $_POST : null,
        );
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    public function bearer(): ?string
    {
        $h = $this->header('authorization');
        if ($h !== null && preg_match('/^Bearer\s+(\S+)$/i', $h, $m)) {
            return $m[1];
        }
        return null;
    }

    /** @return array<string,mixed> JSON (or multipart form) body as an associative array */
    public function body(): array
    {
        if ($this->parsed !== null) {
            return $this->parsed;
        }
        if ($this->form !== null) {
            return $this->parsed = $this->form;
        }
        $raw = trim((string)$this->rawBody);
        if ($raw === '') {
            return $this->parsed = [];
        }
        try {
            $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpException(400, 'Request body must be valid JSON', 'invalid_json');
        }
        if (!is_array($data) || (array_is_list($data) && $data !== [])) {
            throw new HttpException(400, 'Request body must be a JSON object', 'invalid_json');
        }
        return $this->parsed = $data;
    }

    public function intParam(string $name): int
    {
        $v = $this->params[$name] ?? '';
        if (!ctype_digit($v) || strlen($v) > 18) {
            throw HttpException::notFound();
        }
        return (int)$v;
    }

    public function queryString(string $name, ?string $default = null): ?string
    {
        $v = $this->query[$name] ?? null;
        return is_string($v) && $v !== '' ? $v : $default;
    }

    public function queryInt(string $name, ?int $default = null): ?int
    {
        $v = $this->query[$name] ?? null;
        return is_string($v) && ctype_digit($v) ? (int)$v : $default;
    }

    /** Free-text reason attached to a material change (kept in the audit trail). */
    public function changeReason(): ?string
    {
        $r = $this->header('x-change-reason') ?? ($this->body()['change_reason'] ?? null);
        return is_string($r) && trim($r) !== '' ? mb_substr(trim($r), 0, 1000) : null;
    }
}
