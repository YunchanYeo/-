export const ErrorCodes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    HTTP_STATUS_ERROR: 'HTTP_STATUS_ERROR',
    BAD_RESPONSE: 'BAD_RESPONSE',
    BACKEND_ERROR: 'BACKEND_ERROR',
};
export function createAppError(code, message, raw) {
    const err = new Error(message);
    err.code = code;
    err.raw = raw;
    return err;
}
export function getErrorMessage(err) {
    if (!err)
        return 'Unknown error';
    if (typeof err === 'string')
        return err;
    if (err.message)
        return err.message;
    try {
        return JSON.stringify(err);
    }
    catch (e) {
        return String(err);
    }
}
