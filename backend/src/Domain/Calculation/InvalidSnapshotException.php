<?php
declare(strict_types=1);

namespace App\Domain\Calculation;

final class InvalidSnapshotException extends \RuntimeException
{
    /** @param list<array{code:string,message:string,path:string}> $errors */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Calculation inputs are invalid or incomplete');
    }
}
