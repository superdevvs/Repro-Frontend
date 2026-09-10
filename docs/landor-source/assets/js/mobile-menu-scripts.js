(function ($) {
    "use strict";

       // mobile menu 
    var tpMenuWrap = $('.tp-mobile-menu-active > ul').clone();
    var tpSideMenu = $('.tp-offcanvas-menu nav');
    tpSideMenu.append(tpMenuWrap);
    if ($(tpSideMenu).find('.sub-menu, .mega-menu').length != 0) {
      $(tpSideMenu).find('.sub-menu, .mega-menu').parent().append('<button class="tp-menu-close"><i class="fas fa-chevron-right"></i></button>');
    }

    var sideMenuList = $('.tp-offcanvas-menu nav > ul > li button.tp-menu-close, .tp-offcanvas-menu nav > ul li.has-dropdown > a');
    $(sideMenuList).on('click', function (e) {
      e.preventDefault();
      if (!($(this).parent().hasClass('active'))) {
        $(this).parent().addClass('active');
        $(this).siblings('.sub-menu, .mega-menu').slideDown();
      } else {
        $(this).siblings('.sub-menu, .mega-menu').slideUp();
        $(this).parent().removeClass('active');
      }
    });

    // offcanvas 
    $(".tp-offcanvas-toogle").on('click', function(){
      $(".tp-offcanvas").addClass("tp-offcanvas-open");
      $(".tp-offcanvas-overlay").addClass("tp-offcanvas-overlay-open");
    });
    $(".tp-offcanvas-close-toggle,.tp-offcanvas-overlay").on('click', function(){
      $(".tp-offcanvas").removeClass("tp-offcanvas-open");
      $(".tp-offcanvas-overlay").removeClass("tp-offcanvas-overlay-open");
    });



})(jQuery);