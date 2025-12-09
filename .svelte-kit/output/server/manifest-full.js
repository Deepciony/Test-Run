export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["logo-ku.png"]),
	mimeTypes: {".png":"image/png"},
	_: {
		client: {start:"_app/immutable/entry/start.XmyLEp-X.js",app:"_app/immutable/entry/app.DNw1v-kp.js",imports:["_app/immutable/entry/start.XmyLEp-X.js","_app/immutable/chunks/Dd8LfxSm.js","_app/immutable/chunks/BqP7Fzfi.js","_app/immutable/chunks/DFUQbp1x.js","_app/immutable/chunks/BrEPatKm.js","_app/immutable/chunks/Cmq-85tr.js","_app/immutable/chunks/BBmvyhOa.js","_app/immutable/entry/app.DNw1v-kp.js","_app/immutable/chunks/DFUQbp1x.js","_app/immutable/chunks/BrEPatKm.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/BqP7Fzfi.js","_app/immutable/chunks/Rfqus09g.js","_app/immutable/chunks/CDhB7UQu.js","_app/immutable/chunks/D6rtiNno.js","_app/immutable/chunks/BBmvyhOa.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js')),
			__memo(() => import('./nodes/7.js')),
			__memo(() => import('./nodes/8.js')),
			__memo(() => import('./nodes/9.js')),
			__memo(() => import('./nodes/10.js')),
			__memo(() => import('./nodes/11.js')),
			__memo(() => import('./nodes/12.js')),
			__memo(() => import('./nodes/13.js')),
			__memo(() => import('./nodes/14.js')),
			__memo(() => import('./nodes/15.js')),
			__memo(() => import('./nodes/16.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/auth/forget",
				pattern: /^\/auth\/forget\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/auth/login",
				pattern: /^\/auth\/login\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/auth/register",
				pattern: /^\/auth\/register\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/auth/reset-password",
				pattern: /^\/auth\/reset-password\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/officer/create-event",
				pattern: /^\/officer\/create-event\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/officer/event-verify",
				pattern: /^\/officer\/event-verify\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/officer/monthly-reward",
				pattern: /^\/officer\/monthly-reward\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/officer/setting-account",
				pattern: /^\/officer\/setting-account\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 10 },
				endpoint: null
			},
			{
				id: "/officer/upload-proof",
				pattern: /^\/officer\/upload-proof\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 11 },
				endpoint: null
			},
			{
				id: "/student/event-list",
				pattern: /^\/student\/event-list\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 12 },
				endpoint: null
			},
			{
				id: "/student/monthly-reward",
				pattern: /^\/student\/monthly-reward\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 13 },
				endpoint: null
			},
			{
				id: "/student/myevents-upcoming",
				pattern: /^\/student\/myevents-upcoming\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 14 },
				endpoint: null
			},
			{
				id: "/student/setting-account",
				pattern: /^\/student\/setting-account\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 15 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
