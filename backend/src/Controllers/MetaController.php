<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Response;
use App\Domain\Calculation\CalculationEngine;

final class MetaController
{
    public function health(): Response
    {
        return Response::json(['status' => 'ok', 'methodology_version' => CalculationEngine::METHODOLOGY_VERSION]);
    }

    /** Enumerations, units and plain-language formula/glossary text so any client can render help consistently. */
    public function meta(): Response
    {
        return Response::json(['data' => [
            'methodology_version' => CalculationEngine::METHODOLOGY_VERSION,
            'percent_convention' => 'All percentages are fractions between 0 and 1 (0.15 = 15%).',
            'enums' => [
                'cost_categories' => CalculationEngine::COST_CATEGORIES,
                'evidence_quality' => CalculationEngine::QUALITIES,
                'projection_models' => CalculationEngine::MODELS,
                'evaluation_types' => ['forecast', 'evaluative'],
                'investment_basis' => ['nominal', 'present_value'],
                'discount_rate_basis' => ['real', 'nominal'],
                'polarity' => ['positive', 'negative'],
                'roles' => ['owner', 'editor', 'viewer'],
                'proxy_categories' => ['Education', 'Employment and income', 'Health and wellbeing', 'Time savings', 'Poverty reduction',
                    'Environmental benefits', 'Waste management', 'Energy efficiency', 'Community development'],
                'stakeholder_categories' => ['Students and learners', 'Teachers and educational staff', 'Local communities', 'Employees and volunteers',
                    'Beneficiary households', 'Local businesses', 'Government agencies', 'Ecosystems and environmental resources'],
            ],
            'projection_models' => [
                'cohort' => 'One group of beneficiaries; benefit persists for duration_years and declines by the drop-off rate each year after the first.',
                'recurring_cohorts' => 'A new cohort of `quantity` enters each year for entry_years; every cohort decays by its own age.',
                'independent' => 'Quantity is measured for each year (year overrides); drop-off is NOT applied so the decline is never counted twice.',
            ],
            'formulas' => [
                'gross_value' => 'quantity x financial proxy',
                'adjusted_impact' => 'gross x persistence x (1 - deadweight) x (1 - attribution) x (1 - displacement)',
                'persistence' => 'year 1 = 1; year k = year (k-1) x (1 - drop-off for year k)',
                'present_value' => 'adjusted impact / (1 + discount rate) ^ max(0, year - discount_base_year)',
                'sroi_ratio' => 'total present value of social impact / total investment',
                'net_social_value' => 'total present value of social impact - total investment',
                'net_return_pct' => 'net social value / total investment x 100',
            ],
            'glossary' => [
                'deadweight' => 'The share of the outcome that would have happened anyway, without the project.',
                'attribution' => 'The share of the outcome caused by other people, organisations or programmes.',
                'displacement' => 'The share of the benefit that merely moved from somewhere else, reducing a similar benefit elsewhere.',
                'drop_off' => 'How much of the outcome fades each year after the first.',
                'financial_proxy' => 'A monetary estimate of the value of a change. It is not cash received and not verified income.',
                'discount_rate' => 'The annual rate used to express future value in today\'s terms. It must be chosen and justified; no universal rate is assumed.',
            ],
        ]]);
    }
}
