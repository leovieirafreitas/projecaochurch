
let currentStatus = {
    verseText: '',
    reference: '',
    slideIndex: 0,
    version: 'MUSIC',
    style: {}
};

export default function handler(req: any, res: any) {
    if (req.method === 'POST') {
        currentStatus = req.body;
        res.status(200).json({ success: true });
    } else {
        res.status(200).json(currentStatus);
    }
}
