import path from 'path';

export function getDataUserPath() {
    return process.env.VERCEL ? '/tmp/data_user' : path.join(process.cwd(), '..', 'data_user');
}
