// index.js

const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3002;

// ตั้งค่า Pool สำหรับเชื่อมต่อ PostgreSQL
const pool = new Pool({
    user: 'pocharapon.d',
    host: 'eilapgsql.in.psu.ac.th',
    database: 'linechatbot',
    password: '91}m2T3X-;Pz',
    port: 5432,
});

// ตั้งค่า Express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'mysecretkey', // ควรเปลี่ยนเป็นรหัสลับที่ซับซ้อน
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // ตั้งเป็น true ถ้าใช้ HTTPS
}));

// Middleware สำหรับตรวจสอบการ login
const requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// --- Routing ---

// หน้า Login
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM account WHERE username = $1 AND password = $2', [username, password]);
        if (result.rows.length > 0) {
            req.session.user = result.rows[0].username;
            res.redirect('/');
        } else {
            res.render('login', { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' });
    }
});

// หน้าหลัก (CRUD) - ต้อง Login ก่อนถึงจะเข้าได้
app.get('/', requireLogin, async (req, res) => {
    try {
        const types = await pool.query('SELECT DISTINCT type FROM question ORDER BY type');
        const questions = await pool.query('SELECT type, question, answer FROM question ORDER BY type, question');

        res.render('dashboard', {
            username: req.session.user,
            types: types.rows,
            questions: questions.rows,
            selectedType: null // ตั้งค่าเริ่มต้นให้ไม่มีการเลือก type
        });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถโหลดข้อมูลได้' });
    }
});

// แสดงตารางตาม type ที่เลือก
app.post('/filter', requireLogin, async (req, res) => {
    const { type } = req.body;
    try {
        const types = await pool.query('SELECT DISTINCT type FROM question ORDER BY type');
        let questions;

        if (type) { // ถ้ามีการเลือก type ที่ไม่ใช่ "ทั้งหมด"
            questions = await pool.query('SELECT type, question, answer FROM question WHERE type = $1 ORDER BY question', [type]);
        } else { // ถ้าเลือก "ทั้งหมด"
            questions = await pool.query('SELECT type, question, answer FROM question ORDER BY type, question');
        }

        res.render('dashboard', {
            username: req.session.user,
            types: types.rows,
            questions: questions.rows,
            selectedType: type
        });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถกรองข้อมูลได้' });
    }
});

// อัปเดตคำตอบ (answer)
app.post('/update', requireLogin, async (req, res) => {
    const { question, answer, type } = req.body;
    try {
        await pool.query('UPDATE question SET answer = $1 WHERE question = $2 AND type = $3', [answer, question, type]);
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'ไม่สามารถอัปเดตข้อมูลได้' });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// เริ่มต้น Server
app.listen(port, () => {
    console.log(`Server กำลังทำงานที่ http://localhost:${port}`);
});