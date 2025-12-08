
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/auth" | "/auth/forgot-password" | "/auth/login" | "/auth/register" | "/auth/reset-password" | "/not-found" | "/officer" | "/officer/createevent" | "/officer/eventverify" | "/officer/monthly-reward" | "/officer/setting-account" | "/officer/upload-proof" | "/student" | "/student/event-list" | "/student/monthly-reward" | "/student/myevents-upcoming" | "/student/setting-account";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/auth": Record<string, never>;
			"/auth/forgot-password": Record<string, never>;
			"/auth/login": Record<string, never>;
			"/auth/register": Record<string, never>;
			"/auth/reset-password": Record<string, never>;
			"/not-found": Record<string, never>;
			"/officer": Record<string, never>;
			"/officer/createevent": Record<string, never>;
			"/officer/eventverify": Record<string, never>;
			"/officer/monthly-reward": Record<string, never>;
			"/officer/setting-account": Record<string, never>;
			"/officer/upload-proof": Record<string, never>;
			"/student": Record<string, never>;
			"/student/event-list": Record<string, never>;
			"/student/monthly-reward": Record<string, never>;
			"/student/myevents-upcoming": Record<string, never>;
			"/student/setting-account": Record<string, never>
		};
		Pathname(): "/" | "/auth" | "/auth/" | "/auth/forgot-password" | "/auth/forgot-password/" | "/auth/login" | "/auth/login/" | "/auth/register" | "/auth/register/" | "/auth/reset-password" | "/auth/reset-password/" | "/not-found" | "/not-found/" | "/officer" | "/officer/" | "/officer/createevent" | "/officer/createevent/" | "/officer/eventverify" | "/officer/eventverify/" | "/officer/monthly-reward" | "/officer/monthly-reward/" | "/officer/setting-account" | "/officer/setting-account/" | "/officer/upload-proof" | "/officer/upload-proof/" | "/student" | "/student/" | "/student/event-list" | "/student/event-list/" | "/student/monthly-reward" | "/student/monthly-reward/" | "/student/myevents-upcoming" | "/student/myevents-upcoming/" | "/student/setting-account" | "/student/setting-account/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/logo-ku.png" | string & {};
	}
}