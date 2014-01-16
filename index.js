var express = require( 'express' ),
    cradle = require('cradle'),
    passport = require( 'passport' ),
    session = require('connect-ensure-login'),
    bcrypt = require('bcrypt'),
    hat = require( 'hat' ),
    url = require( 'url' ),
    oauth2orize = require( 'oauth2orize' ),
    LocalStrategy = require( 'passport-local' ).Strategy,
    app = express(),
    server = oauth2orize.createServer();

/*****
 * Database Connection
 */
if( process.env.CLOUDANT_URL ){
  console.log( 'CONNECT CLOUDANT' );

  var cloudant_url = url.parse( process.env.CLOUDANT_URL);
  var cloudant_auth = cloudant_url.auth.split( ':' );
  console.log( cloudant_auth );
  cradle.setup({
    'host': cloudant_url.hostname,
    'auth': {
      'username': cloudant_auth[0],
      'password': cloudant_auth[1]
    },
    'cache': true,
    'raw': false 
  })
  var db = new(cradle.Connection)().database('ladata-co');
}else{
  var db = new(cradle.Connection)().database( 'ladata-co' );
}
db.exists(function (err, exists) {
  if (err) {
    console.log('error', err);
  } else if (exists) {
    console.log('the force is with you.');
  } else {
    console.log('database does not exists.');
    db.create();
    /* populate design documents */
  }
});

app.use(express.compress());
app.use('/static', express.static(__dirname + '/public'));

app.set('view engine', 'jade');
app.set('views', __dirname + '/views' );

app.use(express.logger());
app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({ secret: 'keyboard cat' }));

app.use(passport.initialize());
app.use(passport.session());


passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    done(null, { name: 'Javier Jaimes', id:1, username: 'javier'});
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    if( username == 'javier' && password == '123' ){
      return done(null, { name:'Javie Jaimes', id:1, username:'javier'});
    }else{
      return done(null, false, { message: 'Datos incorrectos' });
    }
  }
));


/****
 * OAuth2 Configuration
 */
server.serializeClient(function(client, done) {
  return done(null, client.id);
});

server.deserializeClient(function(id, done) {
  db.get( id, function (err, client) {
    if( err ){  return done( err ) }
    return done(null, client);
  });
});

server.grant(oauth2orize.grant.code(function(client, redirectURI, user, ares, done) {
  db.save({
    'client_id': client.id, 'user_id': user.id, 'type':'codes', 'created_at': new Date()
  }, function (err, code ) {
    if( err ){ return done( err )}
    done( null, code.id );
  });
}));


/****
 * Routes
 */
app.get( '/', function( req, res ){
  console.log( 'USER' );
  console.log( req.user );
  if( req.user == undefined ){
    res.render( 'index', { user: req.user } );
  }else{
    db.view( 'datasets/byUser', {  key: req.user.id }, function( err, docs ){
      console.log( docs );
      res.render( 'dashboard/index', { 'sets': docs, 'user': req.user } );
    })
  }
})
app.get( '/login', function( req, res ){
  res.render( 'sessions/new' );
})
app.post('/login', 
  passport.authenticate('local', { successReturnToOrRedirect: '/', failureRedirect: '/login', failureFlash: true })
);
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});
app.get( '/clients/new', session.ensureLoggedIn( '/login' ), function( req, res){
  res.render( 'clients/new' );
} )
app.get( '/clients/:id', session.ensureLoggedIn( '/login' ), function( req, res ){
  client = req.params.id
  db.get( client, function( err, doc ){
    client = doc;
    console.log( 'Client' );
    console.log( doc );
    db.view( 'tokens/byClient', { key: client.id }, function( err, doc ){
      console.log( 'token' );
      console.log( doc );
    
      res.render( 'clients/show', { 'my_client': client, 'my_token': (doc.length > 0)? doc[0]:false } );
    } )
  })

} )


app.get( '/clients/:id/edit', session.ensureLoggedIn( '/login' ), function( req, res ){
  client = req.params.id
  db.get( client, function( err, doc ){
    if( err ){ console.log( err ); }
    res.render( 'clients/edit', { 'my_client': doc } );
  })

} )

app.get( '/clients', session.ensureLoggedIn( '/login' ), function( req, res){
  db.view( 'clients/byUser', { key: req.user.id }, function( err, docs ){
    res.render( 'clients/index', { 'clients': docs } );
  })
} )
app.post( '/clients/:id', session.ensureLoggedIn( '/login' ), function( req, res ){
  console.log( req.body )

  client = req.body.client;
  db.get( client.id, function( err, doc ){
    if( err ){ console.log( err ); }
    console.log( doc );
  
    db.save( doc._id, doc._rev, { 'name': client.name, 'description': client.description, 'url': client.url, 'callback_url':client.callback_url, 'secret': doc.secret, 'user_id': req.user.id, 'type':'clients', 'update_at': new Date(), 'created_at': doc.created_at }, function( err, doc){ 
      if( err ){ console.log( err ); }

      console.log( doc );
      res.redirect( '/clients' );
    })
  })
})
app.post( '/clients', session.ensureLoggedIn( '/login' ), function( req, res ){
  console.log( req.body );

  client = req.body.client;

  secret = hat( 128, 16 );
  db.save({
    'name': client.name, 'description': client.description, 'url': client.url, 'callback_url': client.callback_url, 'secret': secret, 'type': 'clients', 'user_id': req.user.id, 'created_at': new Date(), 'updated_at': new Date()
  }, function( err, doc ){
    console.log( err );
    console.log( doc );

    if( err ){ return res.render( 'clients/new' ) }

    res.redirect( '/clients' );
  })
})
app.delete( '/clients/:id', session.ensureLoggedIn( '/login' ), function( req, res ){
  console.log( req.params.id );
  console.log( req.body );
  client = req.params.id;
  db.get( client, function( err, doc ){
    if( err ){ console.log( 'Hubo un error' ) }
    console.log( doc );

    db.remove( doc._id, doc._rev, function( err, doc ){
      if( err ){ console.log( 'Hubo un error borrando' ) }

      console.log( doc );

      res.json({ 'status': true, 'data':doc });
    }) 

  })
})
app.post( '/datasets', function( req, res ){
  console.log( req.body );
  console.log( req.body.dataset.fields );


  dataset = req.body.dataset;
  fields = {}
  for( var i in dataset.fields ){
    var field_name = dataset.fields[i].name;
    var field_type = dataset.fields[i].type;
    var field_id = dataset.fields[i].id;

    fields[field_id] = {
      'name': field_name,
      'type': field_type
    }
  }

  db.save({
    'name': dataset.name, 'description':dataset.description, 'fields': fields, 'type': 'datasets', 'updated_at': new Date(), 'created_at': new Date(), 'user_id': req.user.id
  }, function( err, doc ){
    console.log( err );

    if( err ){ console.log( err ) }

    res.redirect( '/datasets/' + doc._id );
  })

  //res.send( 'ok' );

})
app.get( '/datasets', session.ensureLoggedIn('/login'), function( req, res ){
  console.log( 'USER' );
  console.log( req.user );

  user = req.user.id;

  db.view( 'datasets/byUser', { key: user }, function( err, docs){
    console.log( docs );
    res.render( 'datasets/index', { 'sets': docs } );
  } )
})

app.get( '/datasets/new', session.ensureLoggedIn( '/login' ), function( req, res ){
  res.render( 'datasets/new' );
} )

app.get( '/datasets/:id/new', session.ensureLoggedIn( '/login' ), function( req, res){
  
  dataset_id = req.params.id;

  db.get( dataset_id, function( err, doc ){
    res.render( 'data/new', { 'theset': doc } )
  })
} )
app.get( '/datasets/:id', function( req, res ){
  console.log( 'GET ID LIST' )
  console.log( req.params.id );

  dataset_id = req.params.id;

  db.get( dataset_id, function( err, doc ){
    if( err ){ console.log( err ); }
    console.log( 'THE DATASET' );
    console.log( doc );

    db.view( 'data/byDataset', { key: doc._id, reduce: false }, function( err, docs ){
      if( err ){ console.log( 'err', err ); }

      console.log( 'THE DATA' );
      console.log( 'data', docs );

      res.render( 'datasets/show', { 'theset': doc, 'rows': docs, 'user': req.user } );
    } )

  } )
})


app.get( '/datasets/:id/edit', session.ensureLoggedIn( '/login' ), function( req, res ){
  set = req.params.id;
  db.get( set, function( err, doc ){
    if( err ){ console.log( err ); }
    console.log( doc );

    res.render( 'datasets/edit', { 'thedataset': doc } )
  })
})

app.post( '/datasets/:id', session.ensureLoggedIn('/login'), function( req, res ){

  console.log( req.body );

  if( req.body._method == "put" ){
    console.log( req.body );

    dataset_id = req.params.id;
    dataset_params = req.body.dataset;
    console.log( dataset_params.fields );

    db.get( dataset_id, function( err, doc ){
      if( err ){ console.log (err); }

      /*
       * if the remaining fields
       */

      fields = {};
      for( var i in dataset_params.fields ){
        var field_id = dataset_params.fields[i].id;
        var field_name = dataset_params.fields[i].name;
        var field_type = dataset_params.fields[i].type;

        fields[ field_id ] = {
          "name": field_name,
          "type": field_type
        }
      }
      console.log( fields );

      db.save( doc._id, doc._rev, {
        'name': dataset_params.name,
        'description': dataset_params.description,
        'fields': fields,
        'type': 'datasets',
        'updated_at': new Date,
        'created_at': doc.created_at,
        'user_id': req.user.id
      }, function( err, doc ){
        console.log( doc );

        return res.redirect( '/datasets/' + dataset_id );
      })

    })
  }else{

    dataset_id = req.params.id;

    db.get(  dataset_id, function( err, doc ){
    
      data = req.body.data;
      fields = {};
      for( var i in data.fields ){
        var field_value = data.fields[i].value;
        var field_id = data.fields[i].field_id;

        fields[field_id] = field_value;
      }
      db.save({
        'dataset_id': data.dataset_id, 'fields': fields, 'type': 'data', 'user_id': req.user.id, 'updated_at': new Date(), 'created_at': new Date()
      },
      function( err, doc){
        console.log( doc );
      
        res.redirect( '/datasets/' + data.dataset_id  );
      })
    })
  }
})

app.delete( '/datasets/:id', session.ensureLoggedIn( '/login' ), function( req, res ){
  dataset_id = req.params.id
  db.get( dataset_id, function( err, doc ){
    if( err ){ console.log( err ); }
    console.log( doc );
    db.remove( doc._id, doc._rev, function( err, doc ){
      if( err ){ console.log( err ); }
      res.json({ 'status': true, 'data': doc });
    })
  })
})

app.get( '/data/:id/edit', session.ensureLoggedIn( '/login' ), function( req, res ){
  var data_id = req.params.id;

  db.get( data_id, function( err, doc ){
    if( err ){ console.log( err ); }

    var data = doc;
  
    db.get( doc.dataset_id, function( err, doc ){
      if( err ){ console.log( err ); }
    
      res.render( 'data/edit', { 'theset':doc,'thedata': data  } );
    })
  })
})


app.post( '/data/:id', session.ensureLoggedIn( '/login' ), function( req, res ){
  console.log( req.body );

  var data_id = req.params.id;
  var data_params = req.body.data;
  console.log( data_params.fields );

  db.get( data_id, function( err, doc ){
    if( err ){ console.log( err ); }
    console.log( doc );

    var fields = {};
    for( var i in data_params.fields ){
      var field_id = data_params.fields[i].field_id;
      var field_value = data_params.fields[i].value;

      fields[ field_id ] = field_value;
    }

    console.log( fields );
    //Save the new doc
    db.save( doc._id, doc._rev, {
      'dataset_id': data_params.dataset_id,
      'fields': fields,
      'type': 'data',
      'user_id': req.user.id,
      'updated_at': new Date,
      'created_at': doc.created_at
    }, function( err, doc ){
      if( err ){ console.log( err ) };

      res.redirect( '/datasets/' + data_params.dataset_id );
    
    })
  
  })

})

app.delete( '/data/:id', session.ensureLoggedIn( '/login' ), function( req, res ){
  var data_id = req.params.id;
  db.get( data_id, function( err, doc ){
   if( err ){ console.log( err ); } 
   console.log( doc );

   db.remove( doc._id, doc._rev, function( err, doc ){
     res.json({ 'status':true, 'data': doc });
   })

  })
})


app.post( '/token', session.ensureLoggedIn('/login'), function( req, res ){
  console.log( req.body );
  client = req.body.client;
  db.get( client.id, function( err, doc){
    if( err ){ console.log( 'error' )}
    if( client.secret != doc.secret ){ console.log( 'la llave secreta no es la misma' ) }

    //Create and save the token
    var token = hat(256, 16);
    db.save({ 'token': token, 'user_id': req.user.id, 'client_id': client.id, 'type':'tokens', 'created_at': new Date() }, function( err, doc ){
      if( err ){ console.log( 'Hubo un error creando el token' )}
      console.log( doc ); 
    
      res.redirect( '/clients/' + client.id );
    })

  } )
})

app.get( '/signup', function( req, res ){
  res.render( 'users/new' );
} )

app.post( '/users', function( req, res ){

  bcrypt.genSalt( 10, function( err, salt ){
    bcrypt.hash( req.body.password, salt, function( err, hash ){
      db.save({
        name: req.body.name, email: req.body.email, salt: salt, hash: hash, type: 'users'
      }, function( err, user ){
        console.log( 'Save the user' );
        console.log( err );
        console.log( user );

        if( err ){ return res.redirect( 'signup' ); }

        return res.render( 'users/register' );
      })
    })
  })

})

app.get('/dialog/authorize', 
  session.ensureLoggedIn(), 
  server.authorization(function(clientID, redirectURI, done) {
    console.log( 'Start Auth' );
    console.log( clientID );
    console.log( redirectURI );
    db.get( clientID, function (err, client) {
      console.log(client );
      if( err ){  return done( err ) }
      return done(null, client, client.callback_url );
    });
    //return done(null, {id:'12345678', redirectURI: 'http://reporta.co' }, redirectURI);
  }),
  function( req, res ){
    res.render('dialog', { transactionID: req.oauth2.transactionID, user: req.user, client_id: req.oauth2.client });
});

app.post('/dialog/authorize/decision', session.ensureLoggedIn(), server.decision() );

app.use(app.router);
app.listen( process.env.PORT || 3001);
