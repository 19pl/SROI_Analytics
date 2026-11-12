<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\App;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;

/**
 * University-wide SROI Dashboard Controller
 * Aggregates organization-level SROI metrics, faculty comparisons,
 * impact breakdown (economic, social, environmental), trends, and top projects.
 */
class DashboardController
{
    public function __construct(private readonly App $app) {}

    /**
     * GET /dashboard
     * Query params:
     * - fiscal_year: string ('all', '2026', '2025', etc.)
     * - faculty_id: int|string ('all' or specific faculty id)
     */
    public function index(Request $req): Response
    {
        $orgId = $req->user['organization_id'] ?? 1;
        $fiscalYear = $req->query['fiscal_year'] ?? 'all';
        $facultyId = $req->query['faculty_id'] ?? 'all';

        // 1. Fetch all faculties under this organization for filters & comparisons
        $allFaculties = $this->app->db->all(
            'SELECT id, name FROM faculties WHERE organization_id = ? ORDER BY name',
            [$orgId]
        );

        // 2. Fetch all departments under these faculties
        $allDepartments = $this->app->db->all(
            'SELECT d.id, d.faculty_id, d.name 
             FROM departments d 
             JOIN faculties f ON f.id = d.faculty_id 
             WHERE f.organization_id = ?',
            [$orgId]
        );
        $deptToFacultyMap = [];
        foreach ($allDepartments as $d) {
            $deptToFacultyMap[(int)$d['id']] = (int)$d['faculty_id'];
        }

        // 3. Query all non-deleted projects under this organization
        $projects = $this->app->db->all(
            'SELECT p.id, p.name, p.organization_name, p.status, p.evaluation_type,
                    p.start_date, p.end_date, p.analysis_period_years, p.currency,
                    p.faculty_id, p.department_id, p.created_at, p.updated_at
             FROM projects p
             WHERE p.organization_id = ? AND p.deleted_at IS NULL
             ORDER BY p.id DESC',
            [$orgId]
        );

        // Helper to resolve effective faculty for a project
        $getProjectFacultyId = function (array $p) use ($deptToFacultyMap): ?int {
            if ($p['faculty_id'] !== null) {
                return (int)$p['faculty_id'];
            }
            if ($p['department_id'] !== null && isset($deptToFacultyMap[(int)$p['department_id']])) {
                return $deptToFacultyMap[(int)$p['department_id']];
            }
            return null;
        };

        // Attach latest base-case calculation run and outcomes to each project
        $enrichedProjects = [];
        $availableYearsSet = [];

        foreach ($projects as $p) {
            $pid = (int)$p['id'];
            $effectiveFacultyId = $getProjectFacultyId($p);
            $facultyName = null;
            $deptName = null;

            if ($p['faculty_id'] !== null) {
                foreach ($allFaculties as $f) {
                    if ((int)$f['id'] === (int)$p['faculty_id']) {
                        $facultyName = $f['name'];
                        break;
                    }
                }
            } elseif ($p['department_id'] !== null) {
                foreach ($allDepartments as $d) {
                    if ((int)$d['id'] === (int)$p['department_id']) {
                        $deptName = $d['name'];
                        foreach ($allFaculties as $f) {
                            if ((int)$f['id'] === (int)$d['faculty_id']) {
                                $facultyName = $f['name'];
                                break;
                            }
                        }
                        break;
                    }
                }
            }

            // Derive project year(s)
            $startYear = null;
            $endYear = null;
            if (!empty($p['start_date'])) {
                $startYear = (int)substr($p['start_date'], 0, 4);
                $availableYearsSet[$startYear] = true;
            }
            if (!empty($p['end_date'])) {
                $endYear = (int)substr($p['end_date'], 0, 4);
                $availableYearsSet[$endYear] = true;
            }

            // Latest calculation run (base scenario)
            $latestRun = $this->app->db->one(
                'SELECT id, sroi_ratio, present_value, investment, net_social_value, result, created_at
                 FROM calculation_runs
                 WHERE project_id = ?
                 ORDER BY id DESC LIMIT 1',
                [$pid]
            );

            // Fetch outcomes for impact classification
            $outcomeRows = $this->app->db->all(
                'SELECT id, name, category, quantity, proxy_value, include_in_total
                 FROM outcomes
                 WHERE project_id = ?',
                [$pid]
            );

            $p['effective_faculty_id'] = $effectiveFacultyId;
            $p['faculty_name'] = $facultyName;
            $p['department_name'] = $deptName;
            $p['owner_name'] = $deptName ? "{$deptName} ({$facultyName})" : ($facultyName ?? 'มหาวิทยาลัยนเรศวร');
            $p['start_year'] = $startYear;
            $p['end_year'] = $endYear;
            $p['latest_run'] = $latestRun;
            $p['outcomes'] = $outcomeRows;

            $enrichedProjects[] = $p;
        }

        // Available years sorted descending
        $availableYears = array_keys($availableYearsSet);
        rsort($availableYears);

        // 4. Apply Filters (Fiscal Year & Faculty)
        $filteredProjects = array_filter($enrichedProjects, function (array $p) use ($fiscalYear, $facultyId) {
            // Faculty filter
            if ($facultyId !== 'all' && $facultyId !== '' && $facultyId !== null) {
                if ((int)$p['effective_faculty_id'] !== (int)$facultyId) {
                    return false;
                }
            }

            // Fiscal Year filter
            if ($fiscalYear !== 'all' && $fiscalYear !== '' && $fiscalYear !== null) {
                $targetYear = (int)$fiscalYear;
                $sYear = $p['start_year'];
                $eYear = $p['end_year'] ?? $sYear;
                if ($sYear === null) {
                    return false;
                }
                if ($targetYear < $sYear || $targetYear > $eYear) {
                    return false;
                }
            }

            return true;
        });

        // 5. Compute KPIs
        $totalInvestment = 0.0;
        $totalSocialValue = 0.0;
        $completedProjectsCount = 0;
        $draftProjectsCount = 0;

        foreach ($filteredProjects as $p) {
            if ($p['status'] === 'ready') {
                $completedProjectsCount++;
            } else {
                $draftProjectsCount++;
            }

            if ($p['latest_run'] !== null && $p['status'] === 'ready') {
                $inv = (float)$p['latest_run']['investment'];
                $pv = (float)$p['latest_run']['present_value'];
                $totalInvestment += $inv;
                $totalSocialValue += $pv;
            }
        }

        // Rule: Overall SROI = Total Social Value / Total Investment (NEVER average ratios)
        $overallSroi = $totalInvestment > 0 ? round($totalSocialValue / $totalInvestment, 2) : 0.0;

        // 6. Social Value Breakdown (Economic, Social, Environmental)
        $economicVal = 0.0;
        $socialVal = 0.0;
        $envVal = 0.0;

        foreach ($filteredProjects as $p) {
            if ($p['latest_run'] === null || $p['status'] !== 'ready') {
                continue;
            }

            $runResult = json_decode($p['latest_run']['result'] ?? '{}', true);
            $runOutcomes = $runResult['outcomes'] ?? [];

            foreach ($runOutcomes as $ro) {
                if (empty($ro['included'])) {
                    continue;
                }

                $pv = (float)($ro['present_value'] ?? $ro['totals']['present_value'] ?? 0.0);
                if ($pv <= 0) {
                    continue;
                }

                // Match with database outcome record for category
                $dbOutcome = null;
                foreach ($p['outcomes'] as $doc) {
                    if ((int)$doc['id'] === (int)$ro['id']) {
                        $dbOutcome = $doc;
                        break;
                    }
                }

                $cat = strtolower((string)($dbOutcome['category'] ?? $ro['category'] ?? ''));
                $name = (string)($ro['name'] ?? '');

                // Intelligent categorization fallback if category string is empty
                if ($cat === 'economic' || str_contains($name, 'ประหยัด') || str_contains($name, 'ลดภาระค่าใช้จ่าย') || str_contains($name, 'รายได้')) {
                    $economicVal += $pv;
                } elseif ($cat === 'environmental' || str_contains($name, 'โซลาร์') || str_contains($name, 'ไฟฟ้า') || str_contains($name, 'ฝุ่น') || str_contains($name, 'น้ำดื่ม') || str_contains($name, 'ขยะ') || str_contains($name, 'มลพิษ')) {
                    $envVal += $pv;
                } else {
                    $socialVal += $pv;
                }
            }
        }

        $totalCategorized = $economicVal + $socialVal + $envVal;
        $breakdown = [
            'economic' => [
                'label' => 'ผลกระทบด้านเศรษฐกิจ (Economic)',
                'value' => round($economicVal, 2),
                'percentage' => $totalCategorized > 0 ? round(($economicVal / $totalCategorized) * 100, 1) : 0,
                'color' => '#F59E0B',
            ],
            'social' => [
                'label' => 'ผลกระทบด้านสังคมและสุขภาพ (Social)',
                'value' => round($socialVal, 2),
                'percentage' => $totalCategorized > 0 ? round(($socialVal / $totalCategorized) * 100, 1) : 0,
                'color' => '#2563EB',
            ],
            'environmental' => [
                'label' => 'ผลกระทบด้านสิ่งแวดล้อม (Environmental)',
                'value' => round($envVal, 2),
                'percentage' => $totalCategorized > 0 ? round(($envVal / $totalCategorized) * 100, 1) : 0,
                'color' => '#10B981',
            ],
            'total' => round($totalCategorized, 2),
        ];

        // 7. Faculty Performance Comparison
        $facultyStats = [];
        foreach ($allFaculties as $f) {
            $fid = (int)$f['id'];
            $facProjects = array_filter($filteredProjects, fn($p) => (int)$p['effective_faculty_id'] === $fid);

            $fInv = 0.0;
            $fPv = 0.0;
            $fReadyCount = 0;

            foreach ($facProjects as $p) {
                if ($p['latest_run'] !== null && $p['status'] === 'ready') {
                    $fInv += (float)$p['latest_run']['investment'];
                    $fPv += (float)$p['latest_run']['present_value'];
                    $fReadyCount++;
                }
            }

            $fRatio = $fInv > 0 ? round($fPv / $fInv, 2) : ($fPv > 0 ? round($fPv, 2) : 0.0);

            $facultyStats[] = [
                'faculty_id' => $fid,
                'name' => $f['name'],
                'project_count' => count($facProjects),
                'ready_project_count' => $fReadyCount,
                'total_investment' => round($fInv, 2),
                'total_social_value' => round($fPv, 2),
                'sroi_ratio' => $fRatio,
            ];
        }

        // Sort faculties by total social value descending
        usort($facultyStats, fn($a, $b) => $b['total_social_value'] <=> $a['total_social_value']);

        // 8. Top Performing Projects (Top 5 based on adjusted social value)
        $readyProjectsWithRun = array_filter(
            $filteredProjects,
            fn($p) => $p['status'] === 'ready' && $p['latest_run'] !== null
        );

        usort($readyProjectsWithRun, function ($a, $b) {
            return (float)$b['latest_run']['present_value'] <=> (float)$a['latest_run']['present_value'];
        });

        $topProjects = [];
        foreach (array_slice($readyProjectsWithRun, 0, 5) as $p) {
            $topProjects[] = [
                'id' => (int)$p['id'],
                'name' => $p['name'],
                'faculty_name' => $p['faculty_name'] ?? 'มหาวิทยาลัยนเรศวร',
                'department_name' => $p['department_name'],
                'owner_name' => $p['owner_name'],
                'total_investment' => (float)$p['latest_run']['investment'],
                'total_social_value' => (float)$p['latest_run']['present_value'],
                'sroi_ratio' => (float)$p['latest_run']['sroi_ratio'],
                'status' => $p['status'],
                'start_date' => $p['start_date'],
                'end_date' => $p['end_date'],
            ];
        }

        // 9. SROI Performance Trend (Yearly & Monthly)
        $trendYearMap = [];
        $trendMonthMap = [];

        foreach ($filteredProjects as $p) {
            if ($p['latest_run'] === null || $p['status'] !== 'ready') {
                continue;
            }

            $runResult = json_decode($p['latest_run']['result'] ?? '{}', true);
            $annual = $runResult['annual'] ?? [];
            $pStartYear = $p['start_year'] ?? 2026;

            foreach ($annual as $a) {
                if ($a['year'] === 0) {
                    $calYear = (string)$pStartYear;
                    $inv = (float)($a['investment'] ?? 0);
                    if ($inv > 0) {
                        if (!isset($trendYearMap[$calYear])) {
                            $trendYearMap[$calYear] = ['period' => $calYear, 'investment' => 0.0, 'social_value' => 0.0];
                        }
                        $trendYearMap[$calYear]['investment'] += $inv;
                    }
                    continue;
                }
                $calYear = (string)($pStartYear + $a['year'] - 1);
                $inv = (float)($a['investment'] ?? 0);
                $pv = (float)($a['present_value'] ?? 0);

                if (!isset($trendYearMap[$calYear])) {
                    $trendYearMap[$calYear] = ['period' => $calYear, 'investment' => 0.0, 'social_value' => 0.0];
                }
                $trendYearMap[$calYear]['investment'] += $inv;
                $trendYearMap[$calYear]['social_value'] += $pv;
            }

            // Monthly breakdown estimation
            if (!empty($p['start_date'])) {
                $mKey = substr($p['start_date'], 0, 7);
                if (!isset($trendMonthMap[$mKey])) {
                    $trendMonthMap[$mKey] = ['period' => $mKey, 'investment' => 0.0, 'social_value' => 0.0];
                }
                $trendMonthMap[$mKey]['investment'] += (float)$p['latest_run']['investment'];
                $trendMonthMap[$mKey]['social_value'] += (float)$p['latest_run']['present_value'];
            }
        }

        // If no annual distribution from calculations, fall back to project start years
        if (empty($trendYearMap)) {
            foreach ($filteredProjects as $p) {
                if ($p['latest_run'] === null || $p['status'] !== 'ready') continue;
                $yr = (string)($p['start_year'] ?? '2026');
                if (!isset($trendYearMap[$yr])) {
                    $trendYearMap[$yr] = ['period' => $yr, 'investment' => 0.0, 'social_value' => 0.0];
                }
                $trendYearMap[$yr]['investment'] += (float)$p['latest_run']['investment'];
                $trendYearMap[$yr]['social_value'] += (float)$p['latest_run']['present_value'];
            }
        }

        ksort($trendYearMap);
        $yearlyTrend = [];
        foreach ($trendYearMap as $yr => $data) {
            $inv = round($data['investment'], 2);
            $pv = round($data['social_value'], 2);
            $yearlyTrend[] = [
                'period' => $yr,
                'investment' => $inv,
                'social_value' => $pv,
                'sroi_ratio' => $inv > 0 ? round($pv / $inv, 2) : ($pv > 0 ? round($pv, 2) : 0),
            ];
        }

        ksort($trendMonthMap);
        $monthlyTrend = [];
        foreach ($trendMonthMap as $mo => $data) {
            $inv = round($data['investment'], 2);
            $pv = round($data['social_value'], 2);
            $monthlyTrend[] = [
                'period' => $mo,
                'investment' => $inv,
                'social_value' => $pv,
                'sroi_ratio' => $inv > 0 ? round($pv / $inv, 2) : ($pv > 0 ? round($pv, 2) : 0),
            ];
        }

        // 10. Recent Activity
        $recentRuns = $this->app->db->all(
            'SELECT r.id, r.project_id, r.sroi_ratio, r.present_value, r.investment, r.created_at, p.name AS project_name
             FROM calculation_runs r
             JOIN projects p ON p.id = r.project_id
             WHERE p.organization_id = ?
             ORDER BY r.id DESC LIMIT 6',
            [$orgId]
        );

        $recentActivity = [];
        foreach ($recentRuns as $r) {
            $recentActivity[] = [
                'id' => (int)$r['id'],
                'action' => 'calculation_completed',
                'title' => 'คำนวณและประเมินผล SROI สำเร็จ',
                'project_id' => (int)$r['project_id'],
                'project_name' => $r['project_name'],
                'sroi_ratio' => (float)$r['sroi_ratio'],
                'created_at' => $r['created_at'],
            ];
        }

        return Response::json([
            'data' => [
                'kpis' => [
                    'total_investment' => round($totalInvestment, 2),
                    'total_social_value' => round($totalSocialValue, 2),
                    'overall_sroi' => $overallSroi,
                    'total_projects' => count($filteredProjects),
                    'completed_projects' => $completedProjectsCount,
                    'draft_projects' => $draftProjectsCount,
                ],
                'breakdown' => $breakdown,
                'faculties' => $facultyStats,
                'top_projects' => $topProjects,
                'trends' => [
                    'yearly' => $yearlyTrend,
                    'monthly' => $monthlyTrend,
                ],
                'recent_activity' => $recentActivity,
                'filter_options' => [
                    'years' => $availableYears,
                    'faculties' => array_map(fn($f) => ['id' => (int)$f['id'], 'name' => $f['name']], $allFaculties),
                ],
                'active_filters' => [
                    'fiscal_year' => $fiscalYear,
                    'faculty_id' => $facultyId,
                ],
            ],
        ]);
    }
}
