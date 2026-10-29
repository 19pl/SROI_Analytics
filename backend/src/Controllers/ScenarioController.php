<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Access;
use App\Core\Audit;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Domain\Calculation\CalculationEngine;

/**
 * Scenarios hold *overrides* on top of the project's base inputs.
 * assumptions = {
 *   "global":   {quantity_multiplier, proxy_multiplier, deadweight_delta, attribution_delta, displacement_delta,
 *                drop_off_delta, duration_delta_years, discount_rate},
 *   "outcomes": {"<outcomeId>": {quantity, proxy_value, deadweight, attribution, displacement, drop_off, duration_years, include}}
 * }
 * Deltas are percentage points as fractions (0.05 = +5 points). Outcome-level values are absolute and win over global ones.
 */
final class ScenarioController extends ProjectResource
{
    protected function table(): string
    {
        return 'scenarios';
    }

    protected function entity(): string
    {
        return 'scenario';
    }

    protected function rules(): array
    {
        return [
            'name' => ['type' => 'string', 'required' => true, 'max' => 120],
            'description' => ['type' => 'string', 'max' => 2000, 'nullable' => true],
            'kind' => ['type' => 'enum', 'in' => ['conservative', 'optimistic', 'custom'], 'default' => 'custom'],
            'assumptions' => ['type' => 'array', 'default' => []],
        ];
    }

    /** The base case is not user-editable beyond name/description: its assumptions are the project inputs themselves. */
    protected function prepare(array $data, array $project, ?array $existing): array
    {
        if ($existing !== null && (int)$existing['is_base'] === 1) {
            unset($data['assumptions'], $data['kind']);
            return $data;
        }
        if (isset($data['assumptions'])) {
            [$clean, $errors] = (new CalculationEngine())->parseAssumptions($data['assumptions']);
            if ($errors) {
                throw HttpException::unprocessable('Validation failed', array_column($errors, 'message', 'path'));
            }
            $ids = array_map('intval', array_column($this->app->db->all('SELECT id FROM outcomes WHERE project_id = ?', [$project['id']]), 'id'));
            foreach (array_keys($clean['outcomes']) as $oid) {
                if (!in_array($oid, $ids, true)) {
                    throw HttpException::unprocessable('Validation failed', ["assumptions.outcomes.$oid" => 'is not an outcome of this project']);
                }
            }
            $data['assumptions'] = ($clean['global'] === [] && $clean['outcomes'] === [])
                ? '{}'
                : json_encode(['global' => (object)$clean['global'], 'outcomes' => (object)$clean['outcomes']]);
        }
        return $data;
    }

    protected function auditable(array $row): array
    {
        $row = parent::auditable($row);
        return $row;
    }

    public function destroy(Request $req): Response
    {
        $project = Access::project($this->app, $req, $req->intParam('projectId'), 'editor');
        $row = $this->find((int)$project['id'], $req->intParam('id'));
        if ((int)$row['is_base'] === 1) {
            throw HttpException::conflict('The base case cannot be deleted');
        }
        $this->app->db->run('DELETE FROM scenarios WHERE id = ?', [$row['id']]);
        Audit::log($this->app, $req, $project, 'scenario', (int)$row['id'], 'delete', $this->auditable($this->cast($row)), null);
        return Response::noContent();
    }

    protected function cast(array $row): array
    {
        $row = parent::cast($row);
        if (isset($row['is_base'])) {
            $row['is_base'] = (bool)$row['is_base'];
        }
        return $row;
    }
}
