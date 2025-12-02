export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21'),
	() => import('./nodes/22'),
	() => import('./nodes/23'),
	() => import('./nodes/24'),
	() => import('./nodes/25')
];

export const server_loads = [];

export const dictionary = {
		"/": [2],
		"/createevent-officer-2": [4],
		"/createevent-officer": [3],
		"/eventlist-1": [6],
		"/eventlist-2": [7],
		"/eventlist-3": [8],
		"/eventlist": [5],
		"/eventverify-officer": [9],
		"/login": [10],
		"/monthly-reward-completed-user": [11],
		"/monthly-reward-officer": [12],
		"/monthly-reward-user": [13],
		"/myevents-upcoming": [14],
		"/notFound": [15],
		"/register-officer": [16],
		"/register-student": [17],
		"/reset-password-2": [19],
		"/reset-password-3": [20],
		"/reset-password-4": [21],
		"/reset-password": [18],
		"/setting-account-officer": [22],
		"/setting-account-student": [23],
		"/upload-proof-officer-2": [25],
		"/upload-proof-officer": [24]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';