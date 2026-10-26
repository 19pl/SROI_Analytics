<?php
declare(strict_types=1);

namespace App\Core;

class HttpException extends \RuntimeException
{
    /** @param array<mixed> $details */
    public function __construct(
        public readonly int $status,
        string $message,
        public readonly string $errorCode = 'error',
        public readonly array $details = [],
    ) {
        parent::__construct($message);
    }

    public static function notFound(string $what = 'Resource'): self
    {
        return new self(404, "$what not found", 'not_found');
    }

    public static function forbidden(string $msg = 'You do not have permission to do that'): self
    {
        return new self(403, $msg, 'forbidden');
    }

    public static function unauthorized(string $msg = 'Authentication required'): self
    {
        return new self(401, $msg, 'unauthorized');
    }

    public static function conflict(string $msg): self
    {
        return new self(409, $msg, 'conflict');
    }

    /** @param array<mixed> $details */
    public static function unprocessable(string $msg, array $details = [], string $code = 'validation_failed'): self
    {
        return new self(422, $msg, $code, $details);
    }
}
