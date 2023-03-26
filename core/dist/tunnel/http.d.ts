interface ExtraInit {
    keepResponseHeaders?: string[];
}
export declare function fetch(url: RequestInfo | URL, init?: RequestInit & ExtraInit): Promise<Response>;
export declare function getCsrfToken(): string | undefined;
export {};
