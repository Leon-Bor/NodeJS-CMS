var express = require('express');
var accepts = require('accepts')
var router = express.Router();
var ES = require('./elasticsearch');
var FC = require('./functions');
var dirTree = require('directory-tree');
var fs = require('fs');
var multer = require('multer');
/* 
  	GET REQUEST

    Consinder that angular is also using the GET routes. Becarefull, that
  	angular and the node.js don't use the same for showing sites/parts.

*/

router.get('/cms', function (req, res) {
  var lang = accepts(req).language(config.languages)
  console.log("Language " + lang  )
    res.render('cms')
});

// Get all pages
router.get("/cms/pages/all", function(req, res, next) {
  ES.get.all_from_type("page",function(resp){
    res.json(resp)
  }) 
});
// Get all sections
router.get("/cms/sections/all", function(req, res, next) {
  ES.get.all_from_type("section",function(resp){
    res.json(resp)
  }) 
});


// Get all images
router.get("/cms/all-images", function(req, res, next) {

var images = fs.readdirSync('./public/uploads')
res.json(images)

});

//get specific file
router.get('/cms/get-file', function(req, res, next) {

  fs.readFile(req.query.url, 'utf8', function (err, data) {
          if (err) throw err;
          var file = {
            data: data,
            path: req.query.url
          }
            res.json(file)
          }
      );

});

// Get all images
router.get("/cms/navigation/:id", function(req, res, next) {

  ES.get.navigation(req.params.id, function(data) {
        console.log(data)
    data = FC.updateLanguages(data)

    res.json(data)
  })



});

/* 
  POST REQUEST
*/
router.post('/cms/section/:id', function(req, res, next) {
  ES.get.section(req.params.id, function(data){


    data = FC.updateLanguages(data)

    res.json(data)
  })
});

// Create new Section
router.post('/cms/section', function(req, res, next) {
  ES.create.section(req.body, function(resp){
    res.redirect("/cms/section/"+resp._id)
  }) 
});

// get all sections for page
router.post('/cms/multiple-sections', function(req, res, next) {
  ES.get.multiple_sections(req.body, function(resp){
    res.json(resp)
  }) 
});

// Save section changes to DB
router.post('/cms/section/:id/save', function(req, res, next) {

  ES.update.section(req.params.id, req.body._source, function(){
    ES.get.pages_containing_sections(req.params.id, function (resp) {
      if(resp.hits.total > 0){
        resp.hits.hits.forEach(function(hit, index){
          FC.parseGrid(hit, function(page_obj){
            ES.update.page(page_obj._id, page_obj._source, function(){

              if(index === resp.hits.hits.length - 1){
                  

                  // this is shit, fix this and remove timeout
                  setTimeout(function() {

                    reloadAllPages();
                    res.json(200);

                  }, 1000);
                
              }

            })
          })
        })

      }else{
        reloadAllPages();
        res.json(200);
      }
    })
  })


});

// delete section from DB
router.post('/cms/section/:id/delete', function(req, res, next) {

  ES.get.pages_containing_sections(req.params.id, function (resp) {
    if(resp.hits.total == 0){
      ES.delete.section(req.params.id,function(){
        res.json(200)
      })
    }else{
      res.json(400)
    }

  })
});

router.post('/cms/page/:id', function(req, res, next) {
  ES.get.page(req.params.id, function(data){
    data = FC.updateLanguages(data)
    res.json(data)
  })
});

// delete section from DB
router.post('/cms/page/:id/delete', function(req, res, next) {

  ES.delete.page(req.params.id,function(){
    reloadAllPages();
    res.json(200)
  })
  
});

// Save page changes to DB
router.post('/cms/page/:id/save', function(req, res, next) {

    FC.parseGrid(req.body, function(page_obj){

      ES.update.page(req.params.id, page_obj._source, function(){
        reloadAllPages();
        res.json(200)
      })

    })

  
});



// create new page
router.post('/cms/page', function(req, res, next) {
	ES.create.page(req.body, function(resp){
    reloadAllPages();
		res.redirect("/cms/page-grid/"+resp._id);
	}) 
});

// get sass folder and file structure
router.get('/cms/sass-folder', function(req, res, next) {

  var filteredTree = dirTree('./sass', ['.scss']);
  res.json(filteredTree)
});



//get specific sass file
router.post('/cms/delete-file', function(req, res, next) {

  console.log(req.body.url)

  fs.exists(req.body.url, function(exists) {
    if(exists) {
      fs.unlinkSync(req.body.url);
      res.json(200)
    } else {
      res.json(404)
    }
  });

});

//get specific sass file
router.post('/cms/save-file', function(req, res, next) {

  var temp = req.body.data

  if(req.body.path.indexOf(".json") > -1){
    temp = JSON.stringify(req.body.data)
  }

  fs.writeFile(req.body.path, temp , function(err) {
      if(err) {
          return console.log(err);
      }

      res.json({name: req.body.name})
  }); 

});

//get specific sass file
router.post('/cms/save-navigation', function(req, res, next) {


  var parsedNav = FC.parseNavGrid(req.body.navigation)

  ES.update.navigation(req.body._id, parsedNav._source, function(resp) {
    reloadAllPages();
    res.json(200)
  })
  
});


// Upload images
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads')
    },
    filename: function (req, file, cb) {
        cb(null,  Date.now() + "_" + file.originalname )
  }
})

var upload = multer({
  storage: storage
}).single('image');


router.post('/upload', upload, function(req, res, next) {

  res.redirect('/cms/image-upload')

});


// Needs to be the last one, to catch all other URL which are not defined
router.get('/cms/*', function (req, res) {
    res.render('cms')
});

module.exports = router;
