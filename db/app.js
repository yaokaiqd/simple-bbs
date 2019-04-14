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
app.use('/avator', express.static(path.join(__dirname,'/users')))
app.use(bodyParser.urlencoded())
app.use(cookieParser('asdasda9134seasdf_*fdg'))
app.use(async (req,res,next) => {
  req.user = await db.get('SELECT id,name,avator FROM users WHERE id = ?',req.signedCookies.useid)
  next()
})

//主页
app.get('/', async (req,res,next) => {
  try {
    var posts = await db.all(`
    SELECT posts.*,name,avator,count(comment) as c from posts join users on useid = users.id left join comments on posts.id = articleid group by posts.id
    `)
    res.render('index.pug',{posts,user: req.user})
    //暂未解决  如何实现主页显示每一个帖子的评论数
  } catch (e) {
    console.log(e)
  }
})
//登陆
app.route('/login')
  .get((req,res,next) => {
    res.render('login.pug')
  })
  .post(async (req,res,next) => {
    var post = await db.get('SELECT * FROM users WHERE name = ? AND password = ?',req.body.name,req.body.password) 
    if(post) {
      res.cookie('useid',post.id,{
        signed: true,
      })
      res.redirect('/')
    } else {
      res.send('name or password error')
    }
  })
//登出
app.get('/logout',(req,res,next) => {
  res.clearCookie('useid')
  res.redirect('/')
})
//注册
app.route('/register')
  .get((req,res,next) => {
    res.render('register.pug')
  })
  .post(upload.single('avator'),async (req,res,next) => {
    try {
      var user = await db.get('SELECT * FROM users WHERE name = ?',req.body.name)
      if(user) {
        res.end('用户名重复')
      } else {
        console.log(req.body)
        console.log(req.file)
        await db.run('INSERT INTO users VALUES (?,?,?,?,?)',null,req.body.name,req.body.password,req.file.filename,req.file.mimetype)
        res.redirect('/login')
      }
    } catch (e) {
      console.log(e)
    }
  })
//文章查看
app.get('/post/:postid',async (req,res,next) => {
  try {
    var post = await db.get(
      'SELECT posts.*,name FROM posts JOIN users ON posts.useid = users.id WHERE posts.id = ?',req.params.postid)
    if(post) {
      var comment = await db.all(
        'SELECT comments.*,name,avator FROM comments JOIN users ON comments.commentid = users.id WHERE comments.articleid = ?',req.params.postid)
      res.render('article.pug',{post,comment,user:req.user})
    } else {
      res.render('404-not-found.pug')
    }
  } catch (e) {
    console.log(e)
  }
})
//用户主页
app.get('/users/:useid',async (req,res,next) => {
  try {
    var user = await db.get('SELECT * FROM users WHERE id = ?',req.params.useid)
    if(user) {
      var post = await db.all('SELECT * FROM posts WHERE useid = ?',req.params.useid) 
      var comment = await db.all(
        'SELECT comments.*,name,avator FROM comments JOIN users ON comments.commentid = users.id WHERE comments.commentid = ?',req.params.useid)
      res.render('user.pug',{user,post,comment}) 
    } else {
      res.render('404-not-found.pug')
    }
  } catch (e) {
    console.log(e)
  }
})
//添加评论
app.post('/addComment',async (req,res,next) => {
  if(req.signedCookies.useid) {
    await db.run('INSERT INTO comments VALUES (?,?,?,?,?)',null,req.signedCookies.useid,req.body.postid,req.body.comment,Date.now())
    res.redirect('/post/' + req.body.postid)
  } else {
    res.end('please login in account')
  }
})
//添加文章
app.post('/addPost',async (req,res,next) => {
  if(req.signedCookies.useid) {
    try {
      await db.run('INSERT INTO posts VALUES (?,?,?,?,?)',null,req.signedCookies.useid,req.body.content,Date.now(),req.body.title)
      res.redirect('/')
    } catch(e) {
      console.log(e)
    }
  } else {
    res.end('please login in ')
  }
})
app.get('/addPost',(req,res,next) => {
  res.render('addPost.pug',{user:req.user})
})
//修改个人信息
app.route('/setUser')
  .get((req,res,next) => {
    res.render('setUser.pug',{user:req.user})
  })
  .post(upload.single('avator'),async (req,res,next) => {
    
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
