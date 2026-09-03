import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Browsers ask for /favicon.ico unprompted; we ship an SVG. */
export const GET: RequestHandler = () => redirect(301, '/favicon.svg');
