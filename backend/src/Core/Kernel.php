<?php
declare(strict_types=1);

namespace App\Core;

use App\Domain\Calculation\InvalidSnapshotException;

/** HTTP kernel: routing, authentication, error mapping, CORS and security headers. */
final class Kernel
{
    private Router $router;

    public function __construct(private App $app)
    {
        $this->router = new Router();
        (require dirname(__DIR__) . '/routes.php')($this->router, $app);
    }

    public function handle(Request $req): Response
    {
        $rid = bin2hex(random_bytes(8));
        try {
            if ($req->method === 'OPTIONS') {
                $res = Response::noContent();
            } else {
                $prefix = '/api/v1';
                $path = $req->path;
                if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
                    $path = substr($path, strlen($prefix)) ?: '/';
                } else {
                    throw HttpException::notFound('Route');
                }
                $m = $this->router->match($req->method, $path);
                $req->params = $m['params'];
                if (!$m['public']) {
                    Auth::authenticate($this->app, $req);
                }
                $out = ($m['handler'])($req);
                $res = $out instanceof Response ? $out : Response::json($out);
            }
        } catch (HttpException $e) {
            $res = $this->error($e->status, $e->errorCode, $e->getMessage(), $e->details);
        } catch (InvalidSnapshotException $e) {
            $res = $this->error(422, 'calculation_inputs_invalid', $e->getMessage(), $e->errors);
        } catch (\Throwable $e) {
            error_log(sprintf('[%s] %s: %s in %s:%d', $rid, get_class($e), $e->getMessage(), $e->getFile(), $e->getLine()));
            $res = $this->error(500, 'server_error', $this->app->cfg('debug') ? $e->getMessage() : 'Unexpected server error', $this->app->cfg('debug') ? ['request_id' => $rid] : ['request_id' => $rid]);
        }
        return $this->decorate($req, $res, $rid);
    }

    /** @param array<mixed> $details */
    private function error(int $status, string $code, string $message, array $details): Response
    {
        $err = ['code' => $code, 'message' => $message];
        if ($details !== []) {
            $err['details'] = $details;
        }
        return Response::json(['error' => $err], $status);
    }

    private function decorate(Request $req, Response $res, string $rid): Response
    {
        $res->headers += [
            'X-Request-Id' => $rid,
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'no-referrer',
            'Cache-Control' => 'no-store',
        ];
        $origin = $req->header('origin');
        if ($origin !== null) {
            $allowed = (array)$this->app->cfg('cors_origins');
            if (in_array('*', $allowed, true) || in_array($origin, $allowed, true)) {
                // bearer tokens (not cookies) are used, so wildcard origins do not expose credentials
                $res->headers['Access-Control-Allow-Origin'] = in_array('*', $allowed, true) ? '*' : $origin;
                $res->headers['Vary'] = 'Origin';
                $res->headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, X-Change-Reason';
                $res->headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
                $res->headers['Access-Control-Expose-Headers'] = 'Content-Disposition, X-Request-Id';
                $res->headers['Access-Control-Max-Age'] = '600';
            }
        }
        return $res;
    }
}
