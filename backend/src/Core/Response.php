<?php
declare(strict_types=1);

namespace App\Core;

final class Response
{
    /** @param array<string,string> $headers */
    public function __construct(
        public int $status = 200,
        public string $body = '',
        public array $headers = [],
    ) {
    }

    /** @param mixed $data @param array<string,string> $headers */
    public static function json(mixed $data, int $status = 200, array $headers = []): self
    {
        $body = json_encode(
            $data,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_PARTIAL_OUTPUT_ON_ERROR
        );
        return new self($status, $body === false ? '{}' : $body, ['Content-Type' => 'application/json; charset=utf-8'] + $headers);
    }

    /** @param array<string,string> $headers */
    public static function raw(string $body, string $contentType, array $headers = [], int $status = 200): self
    {
        return new self($status, $body, ['Content-Type' => $contentType] + $headers);
    }

    public static function noContent(): self
    {
        return new self(204);
    }

    public function send(): void
    {
        http_response_code($this->status);
        foreach ($this->headers as $k => $v) {
            header("$k: $v");
        }
        if ($this->status !== 204) {
            echo $this->body;
        }
    }
}
