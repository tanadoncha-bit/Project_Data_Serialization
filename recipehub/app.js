require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');

const connectDB = require('./config/db');

const currentUser = require('./middleware/currentUser');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { requireChef } = require('./middleware/requireRole');
var authRouter = require('./routes/auth');
var profileRouter = require('./routes/profile');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var chefRouter = require('./routes/chef');
var homepageRouter = require('./routes/homepage');
var chefRecipesRouter = require('./routes/chefRecipes');
var recipesRouter = require('./routes/recipes');
var mealsRouter = require('./routes/meals');


var app = express();

connectDB();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bootstrap', express.static(
  path.join(__dirname, 'node_modules/bootstrap/dist')));

// session store ล่มต้องไม่ทำให้ทั้งเซิร์ฟเวอร์ crash
const sessionStore = MongoStore.create({ mongoUrl: process.env.MONGODB_URI });
sessionStore.on('error', (err) => console.error('[session] store error:', err.message));

// session เก็บใน MongoDB (collection sessions) รีสตาร์ทเซิร์ฟเวอร์แล้วไม่หลุด login
app.use(session({
  name: 'cookhub.sid',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(currentUser);

app.use('/', authRouter);
app.use('/profile', profileRouter);
app.use('/', indexRouter);
app.use('/users', usersRouter);
// ทุกหน้าที่ขึ้นต้นด้วย /chef ต้องเป็นเชฟเท่านั้น
app.use('/chef', requireChef);
app.use('/chef/recipes', chefRecipesRouter);
app.use('/recipes', recipesRouter);
app.use('/api/meals', mealsRouter);
app.use('/chef', chefRouter);
app.use('/courses', require('./routes/courses'));
app.use('/home', homepageRouter);

// ===== จัดการ error =====
app.use(notFound);
app.use(errorHandler);

// promise ที่ลืม catch จะถูก log ไว้แทนการเงียบหาย
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

module.exports = app;
