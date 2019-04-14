const express = require('express')
const path = require('path')
const bodyParser = require('body-parser')
const sqlite = require('sqlite')
const mime = require('mime')
const multer = require('multer')
const cookieParser = require('cookie-parser')
const port = 8082
const app = express()
const dbPromise = sqlite.open(path.join(__dirname,'/db/bbs.db'),{Promise})
var db
var upload = multer({ dest: path.join(__dirname, '/users/')}) 

app.set('views',path.join(__dirname + '/templates'))
app.locals.pretty = true
app.use((req,res,next) => {
  console.log(req.method,req.url)
  next()
})
app.use('/static', express.static(path.join(__dirname,'/static')))
app.use('/avatar', express.static(path.join(__dirname,'/users')))
app.use(bodyParser.urlencoded())
app.use(bodyParser.json())
app.use(cookieParser('asdasda9134seasdf_*fdg'))
app.use(async (req,res,next) => {
  req.user = await db.get('SELECT id,name,account,avatar FROM users WHERE id = ?',req.signedCookies.useid)
  next()
})

//判断userCookie是否存在
app.get('/api/userInfo', async (req,res,next) => {
  if(req.user) {
    res.json(req.user)
  } else {
    res.json(null)
  }
})
//主页json
app.get('/api/post', async (req,res,next) => {
  try {
    var posts = await db.all(`
    SELECT posts.*,name,avatar,count(comment) as c from posts join users on useid = users.id left join comments on posts.id = articleid group by posts.id
    `)
    res.json(posts)
  } catch (e) {
    console.log(e)
  }
})


//文章查看
app.get('/api/post/:postid',async (req,res,next) => {
  try {
    var post = await db.get(
      'SELECT posts.*,name,users.avatar FROM posts JOIN users ON posts.useid = users.id WHERE posts.id = ?',req.params.postid)
    if(post) {
      var comment = await db.all(
        'SELECT comments.*,name,avatar FROM comments JOIN users ON comments.commentid = users.id WHERE comments.articleid = ?',req.params.postid)
      res.json({post,comment})
    } else {
      res.end('此文章不存在')
    }
  } catch (e) {
    console.log(e)
  }
})
//用户主页
app.get('/api/users/:useid',async (req,res,next) => {
  try {
    var user = await db.get('SELECT id,name,avatar FROM users WHERE id = ?',req.params.useid)
    if(user) {
      var post = await db.all('SELECT * FROM posts WHERE useid = ?',req.params.useid) 
      var comment = await db.all(
        'SELECT comments.*,name,avatar FROM comments JOIN users ON comments.commentid = users.id WHERE comments.commentid = ?',req.params.useid)
      res.json({user,post,comment}) 
    } else {
      res.end('用户不存在')
    }
  } catch (e) {
    console.log(e)
  }
})
//登出
//后端渲染
app.get('/logout',(req,res,next) => {
  res.clearCookie('useid')
  res.end('ok')
})
//注册
app.post('/register',upload.single('avatar'),async (req,res,next) => {
  if(req.body.name && req.body.password && req.body.account) {
    try {
      const avatarName = req.file ? req.file.filename : null
      var msg = await db.run('INSERT INTO users VALUES (?,?,?,?,?,?)',null,req.body.name,req.body.account,req.body.password,avatarName,Date.now())
      res.json('注册成功')
    } catch (e) {
      console.log(e)
    }
  } else {
    res.end(null)
  }
})
//注册用户名检测
app.post('/register/account',async (req,res,next) => {
  try {
    var user = await db.get('SELECT * FROM users WHERE account = ?', req.body.account)
    if(user) {
      res.json('账户重复')
    } else {
      res.json('ok')
    }
  } catch(e) {
    console.log(e)
  }
})
//注册昵称检测
app.post('/register/name', async (req, res, next) => {
  try {
    var user = await db.get('SELECT * FROM users WHERE name = ?', req.body.name)
    if (user) {
      res.json('用户名重复')
    } else {
      res.json('ok')
    }
  } catch (e) {
    console.log(e)
  }
})
//登陆

app.post('/login',async (req,res,next) => {
    var user = await db.get('SELECT id FROM users WHERE account = ? AND password = ?',req.body.account,req.body.password) 
    if(user) {
      res.cookie('useid',user.id,{
        signed: true,
      })
      res.json(user)
    } else {
      res.json('用户名或密码错误')
    }
  })
//添加评论
app.post('/addComment', async (req, res, next) => {
    try {
      await db.run('INSERT INTO comments VALUES (?,?,?,?,?)', null, req.signedCookies.useid, req.body.postid, req.body.comment, Date.now())
      var comment = await db.get(`
        SELECT 
          comments.*,avatar,name FROM comments JOIN users ON comments.commentid = users.id 
        WHERE comments.commentid = ? 
          ORDER BY comments.time DESC LIMIT 1`,req.signedCookies.useid)
      res.json(comment)
    } catch(e) {
      console.log(e)
    }
})
//添加文章
app.post('/addPost', async (req, res, next) => {
    try {
      await db.run('INSERT INTO posts VALUES (?,?,?,?,?)', null, req.signedCookies.useid, req.body.content, Date.now(), req.body.title)
      var article = await db.get('SELECT * FROM posts WHERE useid = ? ORDER BY time DESC LIMIT 1',req.signedCookies.useid) 
      res.json(article)
    } catch (e) {
      console.log(e)
    }
})

//修改个人信息

app.post('/setUser',upload.single('avatar'), async (req, res, next) => {

})
; //此处需要加分号的原因？？？ 解决 
(async function () {
  try {
    db = await dbPromise
    if(db) {
      app.listen(port, () => {
        console.log(`listen on ${port}`)
      })
    }
  } catch (e) {
    console.log(e)
  }
}())

