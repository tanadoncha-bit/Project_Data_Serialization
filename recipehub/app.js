require('dotenv').config({ quiet: true });
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
var chefRouter = require('./routes/chef');
var homepageRouter = require('./routes/homepage');
var chefRecipesRouter = require('./routes/chefRecipes');
var recipesRouter = require('./routes/recipes');
var mealsRouter = require('./routes/meals');


const isProduction = process.env.NODE_ENV === 'production';
if (!process.env.MONGODB_URI || !(process.env.SESSION_SECRET || process.env.JWT_SECRET)) throw new Error('MONGODB_URI and SESSION_SECRET are required');
if (isProduction && (process.env.SESSION_SECRET || process.env.JWT_SECRET).length < 32) throw new Error('Production session secret must contain at least 32 characters');
var app = express();
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);

connectDB();


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/healthz', (req, res) => {
  const ready = require('mongoose').connection.readyState === 1;
  res.set('Cache-Control', 'no-store').status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'starting', ...(process.env.RENDER_GIT_COMMIT ? { revision: process.env.RENDER_GIT_COMMIT } : {}) });
});
app.use(logger(isProduction ? 'combined' : 'dev'));
app.use(express.json({verify:(req,res,buffer)=>{if(req.originalUrl.split('?')[0]==='/payments/omise/webhook')req.rawBody=buffer;}}));
app.use('/payments/omise/webhook',require('./routes/omiseWebhook'));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
const sessionStore = MongoStore.create({ mongoUrl: process.env.MONGODB_URI });
sessionStore.on('error', (err) => console.error('[session] store error:', err.message));


app.use(session({
  name: 'cookhub.sid',
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
}));
app.use(currentUser);
app.use(require('./middleware/chefPageBoundary'));

app.use('/', authRouter);
app.use('/profile', profileRouter);
app.use('/', indexRouter);

app.use('/chef', requireChef);
app.use('/chef/recipes', chefRecipesRouter);
app.use('/recipes', recipesRouter);
app.use('/payments/promptpay',require('./routes/promptpay'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/meals', mealsRouter);
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/course-reviews', require('./routes/courseReviews'));
app.use('/chef', chefRouter);
app.use('/courses', require('./routes/courses'));
app.use('/user', require('./routes/user'));                                                       
app.use('/home', homepageRouter);


app.use(notFound);
app.use(errorHandler);


process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));

module.exports = app;
