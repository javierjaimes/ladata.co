(function( $ ){
  $( function(){
    console.log( 'START APP' );

    $( 'button.add-field' ).on( 'click', function( event ){
      event.preventDefault();

      var id = new Date().getTime();
      var counter = +$( 'fieldset.fields' ).children().size();
      console.log( counter );

      var html = '<label for="dataset[fields][' + id + ']">Campo ' + (counter + 1 ) + '<\/label>' + 
        '<input name="dataset[fields][' + id + '][name]" type="text" placeholder="Eje. Nombre Completo" value="">' +
        '<input name="dataset[fields][' + id + '][id]" type="hidden" value="' + id + '">' +
        '<select name="dataset[fields][' + id + '][type]" style="display: none;">' +
          '<option value="string" selected="selected">Texto<\/option>' +
        '<\/select>';

      var button = $( '<button/>' );
      button.attr( 'type', 'button' );
      button.attr( 'class', 'btn-delete' );
      button.attr( 'data-type', 'fields' );
      button.attr( 'data-id', id );
      button.attr( 'style', 'display: block; position: absolute; top: 32px; right: 12px; width: 55px; height: 30px; background: #f00; border: 1px solid #aaa; color: #fff; cursor: pointer;' );
      button.text( 'Eliminar' );
      button.on( 'click', function( event ){
        event.preventDefault();
        console.log( this );
        id = $( this ).data( 'id' );
        $( 'p.field[data-id="' + id + '"]' ).remove();
      })

      var element = $( '<p/>', { 'class': 'field', 'data-id':id, 'style':'line-height: 1em; position: relative; padding: 0;', 'html': html } )
      element.appendTo( $( 'fieldset.fields' ) );
      button.appendTo( element );

    } )
  })
}( jQuery ))

