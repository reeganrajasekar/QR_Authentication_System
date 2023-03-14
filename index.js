const express = require('express')
const sqlite3 = require('sqlite3')
const session = require('express-session')
const { authenticator } = require('otplib')
const QRCode = require('qrcode')
const bodyParser = require('body-parser')
const app = express()
const port = 3000

app.set('view engine', 'ejs')
app.use(session({
  secret: 'supersecret',
}))

app.use(bodyParser.urlencoded({ extended: false }))

const db = new sqlite3.Database('db.sqlite')
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS `users` (`user_id` INTEGER PRIMARY KEY AUTOINCREMENT, `email` VARCHAR(255) NOT NULL,`password` VARCHAR(255) NOT NULL, `secret` varchar(255) NOT NULL)')
})
db.close()

function verifyLogin (email,password, code, req, res, failUrl) {
    const db = new sqlite3.Database('db.sqlite')
    db.serialize(() => {
        db.get('SELECT secret,email FROM users WHERE email = ? AND password = ?', [email,password], (err, row) => {
            if(err) {
                throw err
            }
            if (!row) {
                return res.redirect('/')
            }
            if (!authenticator.check(code, row.secret)) {
                return res.redirect(failUrl)
            }
            req.session.email = row.email
            res.redirect('/private')
        })
    })  
}

app.get('/', (req, res) => {
    res.render('signup.ejs')
})

app.post('/signup', (req, res) => {
    const email = req.body.email
    const password = req.body.password
    secret = authenticator.generateSecret()
    const db = new sqlite3.Database('db.sqlite')
    db.serialize(() => {
      db.run('INSERT INTO `users`(`email`,`password`, `secret`) VALUES (?, ?,?)',
        [email,password, secret],
        (err) => {
          if (err) {
            throw err
          }
          QRCode.toDataURL(authenticator.keyuri(email, '2FA Node App', secret), (err, url) => {
            if (err) {
              throw err
            }
            req.session.qr = url
            req.session.email = email
            req.session.password = password
            res.redirect('/sign-up-2fa')
          })
        })
    })
})

app.get('/sign-up-2fa', (req, res) => {
    if (!req.session.qr) {
      return res.redirect('/')
    }
    return res.render('signup-2fa.ejs', { qr: req.session.qr })
})

app.post('/sign-up-2fa', (req, res) => {
    if (!req.session.email && !req.session.password) {
      return res.redirect('/')
    }
    const email = req.session.email
    const password = req.session.password
    const code = req.body.code
    return verifyLogin(email,password, code, req, res, '/sign-up-2fa')
})

app.get('/login', (req, res) => {
    return res.render('login.ejs')
})

app.post('/login', (req, res) => {
    //verify login
    const email = req.body.email
    const password = req.body.password
    const code = req.body.code
    return verifyLogin(email,password, code, req, res, '/login')
})

app.get('/private', (req, res) => {
    return res.render('private.ejs', {email: req.session.email})
})    

app.get('/logout', (req, res) => {
    req.session.destroy()
    return res.redirect('/')
})

app.listen(port, () => {
  console.log(`2FA Node app listening at http://localhost:${port}`)
})