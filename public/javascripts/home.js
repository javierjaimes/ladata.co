(function( $ ){
  console.log( 'START HOME' );
  $(function(){

    $( '#menu' ).localScroll({ hash: true, onAfterFirst: function(){
      $('html, body').scrollTo( {top:'-=25px'}, 'fast' );
    }})

    $( '#about-menu' ).localScroll({hash: true, onAfterFirst: function(){
      $('html, body').scrollTo( {top:'-=25px'}, 'fast' );
    }})

    $( '.logo' ).localScroll({ hash: true })
    $( '.read-on' ).localScroll({ hash: true })

    nScroll = 4;
    nVisible = 4;
    $( '#slide-wrapper ul' ).carouFredSel({
      responsive: true,
      width: '100%',
      height: '71px',
      scroll: nScroll,
      items: {
        width: 192,
        visible: nVisible
      },
      swipe: {
        onMouse: true,
        onTouch: true,
      },
      pagination: '#foo2_pag'
    })

  })
 })(jQuery)
