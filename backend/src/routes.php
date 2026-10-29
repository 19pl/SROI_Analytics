<?php
declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\CalculationController;
use App\Controllers\CostController;
use App\Controllers\DepartmentController;
use App\Controllers\EvidenceController;
use App\Controllers\FacultyController;
use App\Controllers\MetaController;
use App\Controllers\OrganizationController;
use App\Controllers\OutcomeController;
use App\Controllers\ProjectController;
use App\Controllers\ProxyController;
use App\Controllers\ReportController;
use App\Controllers\ScenarioController;
use App\Controllers\StakeholderController;
use App\Core\App;
use App\Core\Router;

return function (Router $r, App $app): void {
    $meta = new MetaController();
    $auth = new AuthController($app);
    $orgs = new OrganizationController($app);
    $projects = new ProjectController($app);
    $costs = new CostController($app);
    $stakeholders = new StakeholderController($app);
    $outcomes = new OutcomeController($app);
    $scenarios = new ScenarioController($app);
    $calc = new CalculationController($app);
    $evidence = new EvidenceController($app);
    $proxies = new ProxyController($app);
    $reports = new ReportController($app);
    $faculties   = new FacultyController($app);
    $departments = new DepartmentController($app);

    // public (there is deliberately no self-registration: accounts are created with `php bin/user.php add`)
    $r->add('GET', '/health', [$meta, 'health'], true);
    $r->add('GET', '/meta', [$meta, 'meta'], true);
    $r->add('POST', '/auth/login', [$auth, 'login'], true);
    $r->add('GET', '/shared/{token}', [$reports, 'shared'], true);

    // account
    $r->add('POST', '/auth/logout', [$auth, 'logout']);
    $r->add('GET', '/auth/me', [$auth, 'me']);

    // organisations, members, proxy library
    $r->add('GET', '/organizations', [$orgs, 'index']);
    $r->add('POST', '/organizations', [$orgs, 'store']);
    $r->add('GET', '/organizations/{id}/members', [$orgs, 'members']);
    $r->add('POST', '/organizations/{id}/members', [$orgs, 'addMember']);
    $r->add('PATCH', '/organizations/{id}/members/{userId}', [$orgs, 'updateMember']);
    $r->add('DELETE', '/organizations/{id}/members/{userId}', [$orgs, 'removeMember']);
    $r->add('POST', '/organizations/{id}/proxies', [$proxies, 'store']);
    $r->add('GET', '/proxies', [$proxies, 'index']);
    $r->add('GET', '/proxies/{id}', [$proxies, 'show']);
    $r->add('PATCH', '/proxies/{id}', [$proxies, 'update']);
    $r->add('DELETE', '/proxies/{id}', [$proxies, 'destroy']);

    // projects
    $r->add('GET', '/projects', [$projects, 'index']);
    $r->add('POST', '/projects', [$projects, 'store']);
    $r->add('GET', '/projects/{projectId}', [$projects, 'show']);
    $r->add('PATCH', '/projects/{projectId}', [$projects, 'update']);
    $r->add('DELETE', '/projects/{projectId}', [$projects, 'destroy']);
    $r->add('POST', '/projects/{projectId}/restore', [$projects, 'restore']);
    $r->add('GET', '/projects/{projectId}/audit', [$projects, 'audit']);

    // CRUD children
    foreach ([['costs', $costs], ['stakeholders', $stakeholders], ['outcomes', $outcomes], ['scenarios', $scenarios]] as [$name, $c]) {
        $r->add('GET', "/projects/{projectId}/$name", [$c, 'index']);
        $r->add('POST', "/projects/{projectId}/$name", [$c, 'store']);
        $r->add('GET', "/projects/{projectId}/$name/{id}", [$c, 'show']);
        $r->add('PATCH', "/projects/{projectId}/$name/{id}", [$c, 'update']);
        $r->add('DELETE', "/projects/{projectId}/$name/{id}", [$c, 'destroy']);
    }
    $r->add('GET', '/projects/{projectId}/outcomes/{id}/adjustment', [$outcomes, 'getAdjustment']);
    $r->add('PUT', '/projects/{projectId}/outcomes/{id}/adjustment', [$outcomes, 'putAdjustment']);
    $r->add('GET', '/projects/{projectId}/outcomes/{id}/year-projections', [$outcomes, 'getYears']);
    $r->add('PUT', '/projects/{projectId}/outcomes/{id}/year-projections', [$outcomes, 'putYears']);

    // evidence
    $r->add('GET', '/projects/{projectId}/evidence', [$evidence, 'index']);
    $r->add('POST', '/projects/{projectId}/evidence', [$evidence, 'store']);
    $r->add('GET', '/projects/{projectId}/evidence/{id}/download', [$evidence, 'download']);
    $r->add('DELETE', '/projects/{projectId}/evidence/{id}', [$evidence, 'destroy']);

    // calculation
    $r->add('GET', '/projects/{projectId}/summary', [$calc, 'summary']);
    $r->add('GET', '/projects/{projectId}/review', [$calc, 'review']);
    $r->add('GET', '/projects/{projectId}/dashboard', [$calc, 'dashboard']);
    $r->add('POST', '/projects/{projectId}/calculate', [$calc, 'calculate']);
    $r->add('GET', '/projects/{projectId}/runs', [$calc, 'runs']);
    $r->add('GET', '/projects/{projectId}/runs/{id}', [$calc, 'run']);
    $r->add('GET', '/projects/{projectId}/run-comparison', [$calc, 'compareRuns']);
    $r->add('GET', '/projects/{projectId}/scenario-comparison', [$calc, 'scenarioComparison']);
    $r->add('GET', '/projects/{projectId}/sensitivity', [$calc, 'sensitivity']);
    $r->add('POST', '/calculator/preview', [$calc, 'preview']);

    // reports
    $r->add('GET', '/projects/{projectId}/reports', [$reports, 'index']);
    $r->add('POST', '/projects/{projectId}/reports', [$reports, 'store']);
    $r->add('GET', '/reports/{id}', [$reports, 'show']);
    $r->add('GET', '/reports/{id}/export', [$reports, 'export']);
    $r->add('DELETE', '/reports/{id}', [$reports, 'destroy']);
    $r->add('POST', '/reports/{id}/share', [$reports, 'share']);
    $r->add('DELETE', '/reports/{id}/share', [$reports, 'unshare']);

    // faculties
    $r->add('GET',    '/organizations/{id}/faculties',              [$faculties,   'index']);
    $r->add('POST',   '/organizations/{id}/faculties',              [$faculties,   'store']);
    $r->add('GET',    '/faculties/{facultyId}',                     [$faculties,   'show']);
    $r->add('PATCH',  '/faculties/{facultyId}',                     [$faculties,   'update']);
    $r->add('DELETE', '/faculties/{facultyId}',                     [$faculties,   'destroy']);
    $r->add('GET',    '/faculties/{facultyId}/departments',         [$faculties,   'departments']);
    $r->add('GET',    '/faculties/{facultyId}/report',              [$faculties,   'report']);

    // departments
    $r->add('POST',   '/faculties/{facultyId}/departments',         [$departments, 'store']);
    $r->add('GET',    '/departments/{departmentId}',                [$departments, 'show']);
    $r->add('PATCH',  '/departments/{departmentId}',                [$departments, 'update']);
    $r->add('DELETE', '/departments/{departmentId}',                [$departments, 'destroy']);
};
