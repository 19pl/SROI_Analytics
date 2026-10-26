<?php
declare(strict_types=1);

namespace App\Core;

final class Router
{
    /** @var list<array{method:string,regex:string,names:list<string>,handler:callable,public:bool}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler, bool $public = false): void
    {
        $names = [];
        $regex = preg_replace_callback('#\{(\w+)\}#', function ($m) use (&$names) {
            $names[] = $m[1];
            return '([^/]+)';
        }, $pattern);
        $this->routes[] = [
            'method' => strtoupper($method),
            'regex' => '#^' . $regex . '$#',
            'names' => $names,
            'handler' => $handler,
            'public' => $public,
        ];
    }

    /**
     * @return array{handler:callable,public:bool,params:array<string,string>}
     */
    public function match(string $method, string $path): array
    {
        $pathMatched = false;
        foreach ($this->routes as $r) {
            if (preg_match($r['regex'], $path, $m)) {
                $pathMatched = true;
                if ($r['method'] !== $method && !($method === 'HEAD' && $r['method'] === 'GET')) {
                    continue;
                }
                array_shift($m);
                $params = [];
                foreach ($r['names'] as $i => $n) {
                    $params[$n] = urldecode($m[$i]);
                }
                return ['handler' => $r['handler'], 'public' => $r['public'], 'params' => $params];
            }
        }
        if ($pathMatched) {
            throw new HttpException(405, 'Method not allowed', 'method_not_allowed');
        }
        throw HttpException::notFound('Route');
    }
}
