export function createHealthService() {
    function health(req, res) {
        res.json({ ok: true, message: 'backend is running' });
    }
    return { health };
}
