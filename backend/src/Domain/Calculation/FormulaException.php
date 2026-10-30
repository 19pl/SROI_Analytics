<?php
declare(strict_types=1);

namespace App\Domain\Calculation;

final class FormulaException extends \RuntimeException
{
    public function __construct(string $message, public readonly int $position = 0)
    {
        parent::__construct($message);
    }
}
