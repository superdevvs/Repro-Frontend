(function ($) {
    "use strict";
    
    var windowOn = $(window);

    windowOn.on('load', function () {
		$("#loading").fadeOut(500);
	});

	// 17. scroll wrapper //
	gsap.registerPlugin(ScrollTrigger, ScrollSmoother, ScrollToPlugin, SplitText);
	if($('#smooth-wrapper').length && $('#smooth-content').length){
		ScrollSmoother.create({
			smooth: .5,
			effects: true,
			smoothTouch: .1,
			ignoreMobileResize: true
		})
	}
    // media selection
    var mm = gsap.matchMedia();

    var TPMenu = {
        init: function () {
            this.mobileMenu();
            this.offcanvas();
        },
        mobileMenu: function () {
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
        },
        offcanvas: function () {
            // offcanvas 
            $(".tp-offcanvas-toogle").on('click', function(){
                $(".tp-offcanvas").addClass("tp-offcanvas-open");
                $(".tp-offcanvas-overlay").addClass("tp-offcanvas-overlay-open");
            });
            $(".tp-offcanvas-close-toggle,.tp-offcanvas-overlay").on('click', function(){
                $(".tp-offcanvas").removeClass("tp-offcanvas-open");
                $(".tp-offcanvas-overlay").removeClass("tp-offcanvas-overlay-open");
            });
        }
    };

    $(document).ready(function () {
        TPMenu.init();
    });
    

    // team-open
    $(".team-open").on('click', function() {
        $(this).closest(".tpexperts").toggleClass("active");
    });
    // services button 
    $(".tp-services-button").on("click", function(){
        var target = $(this).closest(".tp-services-item").next();
        $(".tp-services-item").next().not(target).removeClass("active");
        target.addClass("active");
    });

    // data width 
	$("[data-width]").each(function () {
		$(this).css("width", $(this).attr("data-width"));
	});  

    // data bg img 
    $("[data-background]").each(function () {
        $(this).css("background-image", "url(" + $(this).attr("data-background") + ")")
    })

    // hover active 
    var hoverClasses = $(".hover");
    hoverClasses.on("mouseenter", function() {
            $(hoverClasses).removeClass("active");
            $(this).addClass("active");
        }
    );
    // popup image 
	$('.popup-image').magnificPopup({
		type: 'image',
		gallery: {
			enabled: true
		}
	});

    // popup video 
    $('.popup-video').magnificPopup({
        type: 'iframe'
        // other options
    });

    // niceSelect
    $(document).ready(function(){
        $('select').niceSelect();
    });
    
    // jarallax
    jarallax(document.querySelectorAll('.jarallax'), {
     speed: 0.2
    });

    // backToTopBtn 
    var backToTopBtn     = $('#back_to_top');
    var backToTopWrapper = $('.back-to-top-wrapper');
    windowOn.on('scroll', function () {
        windowOn.scrollTop() > 300
            ? backToTopWrapper.addClass('back-to-top-btn-show')
            : backToTopWrapper.removeClass('back-to-top-btn-show');
    });
    $(backToTopBtn).on('click', function (e) {
        e.preventDefault();
        $('html, body').animate({ scrollTop: 0 }, '300');
    });

    // stciky header 
    windowOn.on('scroll', function () {
    var scrollTop = windowOn.scrollTop();
    scrollTop < 20
        ? $('#header-sticky').removeClass('header-sticky')
        : $('#header-sticky').addClass('header-sticky');
    });


    // odometer 
    windowOn.on('load', function () {
        $('.odometer').each(function () {
            var $this = $(this);
            $this.waypoint(function (direction) {
                if (direction === 'down' && !$this.hasClass('loaded')) {
                    $this.html($this.data('count'));
                    $this.addClass('loaded');
                }
            }, { offset: '90%' });
        });
    });

    // marquee 
    $('.marquee').marquee({
        duration: 20000,
        gap: 50,
        delayBeforeStart: 0,
        direction: 'left',
        duplicated: true,
        startVisible: true
    });

    // marquee right 
    $('.marquee-right').marquee({
        duration: 20000,
        gap: 50,
        delayBeforeStart: 0,
        direction: 'right',
        duplicated: true,
        startVisible: true
    });

    // circle text 
    gsap.to(".circle-text", {
        rotation: 360,
        duration: 8,
        repeat: -1,
        ease: "linear"
    });


    // brand slider 
    var swiper = new Swiper(".tp-brand-active", {
        slidesPerView: 6,
        spaceBetween: 0,
        centeredSlides: true,
        allowTouchMove: false,
        freemode: true,
        loop: true,
        speed: 4000,
        autoplay: {
            delay: 0,
            disableOnInteraction: true,
        },
        breakpoints: {
            0: {
              slidesPerView: 2,
            },
            568: {
              slidesPerView: 3,
            },
            768: {
              slidesPerView: 3,
            },
            992: {
              slidesPerView: 4,
            },
            1200: {
              slidesPerView: 6,
            },
          },
    });

    // team slider 
    var swiper = new Swiper(".tp-team-active", {
        slidesPerView: 'auto',
        spaceBetween: 40,
        loop : true,
        speed : 2000,
        centeredSlides: true,
        autoplay :{
         delay : 1000,
         disableOnInteraction : false,
        },
        keyboard: {
            enabled: true,
        },
        breakpoints: {
            0: {
              slidesPerView: 1,
              spaceBetween: 15,
            },
            568: {
              slidesPerView: 1,
               spaceBetween: 15,
            },
            768: {
              slidesPerView: 2,
              spaceBetween: 20,
            },
            992: {
              slidesPerView: 3,
              spaceBetween: 30,
            },
            1200: {
              slidesPerView: 3,
              spaceBetween: 40,
            }
          },
    });

    // team slider 2 
    var swiper = new Swiper(".tp-team-active-2", {
    slidesPerView: 4,
    spaceBetween: 30,
    speed : 1000,
    autoplay :{
        delay : 1000,
        disableOnInteraction : false,
    },
    pagination: {
        el: ".tpteam__circle-pagination",
        clickable: true,
    },
    breakpoints: {
        0: {
            slidesPerView: 1,
        },
        568: {
            slidesPerView: 2,
        },
        768: {
            slidesPerView: 3,
        },
        992: {
            slidesPerView: 3,
        },
        1200: {
            slidesPerView: 4,
        }
        },
    });
    // team slider 2 
    var swiper = new Swiper(".tp-career-active", {
        slidesPerView: 1,
        spaceBetween: 0,
        navigation: {
            nextEl: ".tp-testimonail-career-next",
            prevEl: ".tp-testimonail-career-prev",
        },
        loop : true,
        speed : 1000,
        centeredSlides: true,
        autoplay :{
         delay : 2000,
         disableOnInteraction : false,
        },
    });

    // testimonial slider
    var testimonialSlider = new Swiper(".tp-testimonail-active", {
        slidesPerView: 1,
        spaceBetween: 30,
        centeredSlides: true,
        pagination: {
            el: ".tp-testimonail-pagination",
            type: "fraction",
            renderFraction: function (currentClass, totalClass) {
                return '<span class="' + currentClass + '"></span>' +
                    '<span class="tp-testimonail-dvdr tp-testimonail-progress"></span>' +
                    '<span class="' + totalClass + '"></span>';
            },
            formatFractionCurrent: function (number) {
                return number < 10 ? "0" + number : number;
            },
            formatFractionTotal: function (number) {
                return number < 10 ? "0" + number : number;
            },
        },
        navigation: {
            nextEl: ".tp-testimonail-button-next",
            prevEl: ".tp-testimonail-button-prev",
        },
        on: {
            init: function () {
                updateProgress(this);
            },
            slideChange: function () {
                updateProgress(this);
            },

        },
        speed : 2000,
        centeredSlides: true,
        autoplay :{
         delay : 2000,
         disableOnInteraction : false,
        },
    });

    function updateProgress(swiper){
        var totalSlides = swiper.slides.length;
        var currentSlide = swiper.realIndex + 1;
        var progress = (currentSlide / totalSlides) * 100;
        var progressBar = document.querySelector(".tp-testimonail-progress");
        if(progressBar){
            progressBar.style.setProperty('--progress', progress + "%");
        }
    }

    // gallery slider 
    var swiper = new Swiper(".swiper_gallery_active", {
        effect: "cards",
        grabCursor: true,
        initialSlide: 1,
        centeredSlides: true,
        slidesPerView: 1,
        speed: 500,
        loop: true,
        rotate: true,
    });
    
    // project gallery 
    var swiper = new Swiper(".tp-project-gallery-active", {
      slidesPerView: 3,
      spaceBetween: 20,
      loop: true,
      autoplay:{
        delay:2000,
      },
      speed: 2000,
      breakpoints: {
        0: {
            slidesPerView: 1,
        },
        568: {
            slidesPerView: 2,
        },
        768: {
            slidesPerView: 3,
        },
        992: {
            slidesPerView: 3,
        },
        1200: {
            slidesPerView: 3,
        }
      },
    });

    // hero active 
    var swiper = new Swiper(".tp-hero-slider-active", {
        slidesPerView: 1,
        effect: 'fade',
        pagination: {
            el: ".tp-hero-slider-pagination",
            clickable: true,
        },
        loop: true,
        autoplay:{
            delay:3000,
        },
        speed: 1000
    });

    //  tp-gallery-slider
    var swiper = new Swiper(".tp-hero-gallery-slider", {
        effect: "coverflow",
        grabCursor: true,
        centeredSlides: true,
        coverflowEffect: {
            rotate: 0,
            stretch: 0,
            depth: 150,
            modifier: 4,
            slideShadows: true
        },
        loop: true,
        autoplay:{
            delay:2000,
        },
        speed: 1500,
        keyboard: {
            enabled: true
        },
        breakpoints: {
            560: {
            slidesPerView: 2,
            },
            768: {
            slidesPerView: 2.5,
            },
            1024: {
            slidesPerView: 2.5,
            }
        }
        });

    // contect active
    var swiper = new Swiper(".tp-contect-slider-active", {
        slidesPerView: 1,
        effect: 'slide',
        loop: true,
        centeredSlides: true,
        speed: 1000,
        autoplay: {
            delay: 2500,
            disableOnInteraction: false,
            waitForTransition: true
        },
        navigation: {
            nextEl: ".tp-contect-button-next",
            prevEl: ".tp-contect-button-prev",
        },
    });

    // // protfolio pin 
    if (document.querySelector(".tp-protfolio-pin-2")) {
        const pr = ScrollTrigger.matchMedia();
        pr.add("(min-width: 1199px)", () => {
            const sections = document.querySelectorAll(".tp-protfolio-panel-2");
            const wrap = document.querySelector(".tp-protfolio-pin-2");
            if (!sections.length || !wrap) return;
            sections.forEach((section) => {
                ScrollTrigger.create({
                    trigger: section,
                    start: "top 10%",
                    end: "bottom bottom",
                    pin: true,
                    scrub: true,
                    pinSpacing: false,
                    endTrigger: wrap,
                    markers: false
                });
            });
            return () => {
                ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
            };
        });
    }
    // // protfolio pin 
    if (document.querySelector(".tp-protfolio-pin")) {
        const pr = ScrollTrigger.matchMedia();
        pr.add("(min-width: 1199px)", () => {
            const sections = document.querySelectorAll(".tp-protfolio-panel");
            const wrap = document.querySelector(".tp-protfolio-pin");
            if (!sections.length || !wrap) return;
            sections.forEach((section) => {
                ScrollTrigger.create({
                    trigger: section,
                    start: "top 10%",
                    end: "bottom bottom",
                    pin: true,
                    scrub: true,
                    pinSpacing: false,
                    endTrigger: wrap,
                    markers: false
                });
            });
            return () => {
                ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
            };
        });
    }

    // project slider 
    if (document.querySelector(".project-slider-wrap")) {
        const pr = ScrollTrigger.matchMedia();
        pr.add("(min-width: 1199px)", () => {
            const sections = document.querySelectorAll(".project-slider-panel");
            const wrap = document.querySelector(".project-slider-wrap");
            if (!sections.length || !wrap) return;
            // Initial state
            gsap.set(sections, { scale: 1 });
            // Animate each section except the last one
            sections.forEach((section, index) => {
                const isLast = index === sections.length - 1;
                gsap.to(section, {
                    scale: isLast ? 1 : 1, 
                    ease: "none",
                    scrollTrigger: {
                        trigger: section,
                        start: "top top",
                        end: "bottom bottom",
                        scrub: true,
                        pin: true,
                        pinSpacing: false,
                        endTrigger: wrap,
                        markers: false,
                    },
                });
            });

            // Cleanup on condition change
            return () => {
                ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
            };
        });
    }
	function perspective() {
        if ($('.tp-perspective-slider').length) {
            gsap.set('.tp-perspective-slider .tp-perspective-main .tp-perspective-inner', { perspective: 150 });
            $('.tp-perspective-slider .tp-perspective-main .tp-perspective-inner .tp-perspective-image').each(function () {
                var slide = $(this);
                gsap.fromTo(this, {
                    scaleX: 1,
                    z: '0vh'
                }, {
                    scaleX: .8,
                    z: '-2vh',
                    scrollTrigger: {
                        trigger: slide,
                        start: "top+=150px bottom",
                        end: "bottom top",
                        immediateRender: false,
                        scrub: 0.1,
                    }
                });
            });

        }
    }
    perspective()

    // choose-slider-1
    var globalTimeline = gsap.timeline();
    mm.add('(min-width: 992px)', function () {
        var heroAreas = document.querySelectorAll('.tp-choose-slide');
        heroAreas.forEach(function (area) {
            globalTimeline.to(area, {
                scrollTrigger: {
                    trigger: '.tp-choose-slide-wrap',
                    pin: '.tp-choose-slide',
                    scrub: 1,
                    start: 'top 10%',
                    end: 'bottom 2%',
                    endTrigger: '.tp-choose-slide-wrap',
                    pinSpacing: false,
                    markers: false,
                }
            });
        });
    });


    // Ekhane apnar deya code-ti hobe
    var globalTimeline = gsap.timeline();
    mm.add('(min-width: 992px)', function () {
        var heroAreas = document.querySelectorAll('.tp-choose-slide-2');
        heroAreas.forEach(function (area) {
            globalTimeline.to(area, {
                scrollTrigger: {
                    trigger: '.tp-choose-slide-wrap-2',
                    pin: '.tp-choose-slide-2',
                    scrub: 1,
                    start: 'top top',
                    end: 'bottom bottom',
                    endTrigger: '.tp-choose-slide-wrap-2',
                    pinSpacing: false,
                }
            });
        });
        var parallaxItems = document.querySelectorAll('[data-parallax-y]');
        parallaxItems.forEach(function (item) {
            var yVal = item.getAttribute('data-parallax-y') || 0;
            var scrubVal = item.getAttribute('data-parallax-scrub') || 1;
            gsap.to(item, {
                y: yVal,
                ease: "none",
                scrollTrigger: {
                    trigger: item,
                    start: "top bottom", 
                    end: "bottom top",
                    scrub: parseFloat(scrubVal), 
                }
            });
        });
    });

    // hover-reveal-img
    var hoverRevealItems = document.querySelectorAll('.hover-reveal-img');
    function updateRevealPosition(e, el) {
        var rect   = el.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        var mouseY = e.clientY - rect.top;
        if (el.children[1]) {
            el.children[1].style.transform = 'translate(' + mouseX + 'px, ' + mouseY + 'px)';
        }
    }
    hoverRevealItems.forEach(function (item) {
        item.addEventListener('mousemove', function (e) {
            setInterval(updateRevealPosition(e, item), 100);
        });
    });

    function moving_text() {
        if ($('.moving-text').length > 0) {
        gsap.utils.toArray('.moving-text').forEach((section) => {
                const w = section.querySelector('.wrapper-text');
                gsap.fromTo(w, { 
                    x: 500,
                }, {
                    x: -300,
                    scrollTrigger: {
                        trigger: section,
                        start: "top bottom", 
                        end: "bottom top",   
                        scrub: 2, 
                        invalidateOnRefresh: true
                    }
                });
            });
        }
    }
    windowOn.on('load', function() {
        moving_text();
    });

	// 28. fade-class-active //
	if ($(".tp_fade_anim").length > 0) {
		gsap.utils.toArray(".tp_fade_anim").forEach((item) => {
			let tp_fade_offset = item.getAttribute("data-fade-offset") || 40,
				tp_duration_value = item.getAttribute("data-duration") || 0.75,
				tp_fade_direction = item.getAttribute("data-fade-from") || "bottom",
				tp_onscroll_value = item.getAttribute("data-on-scroll") || 1,
				tp_delay_value = item.getAttribute("data-delay") || 0.15,
				tp_ease_value = item.getAttribute("data-ease") || "power2.out",
				tp_anim_setting = {
					opacity: 0,
					ease: tp_ease_value,
					duration: tp_duration_value,
					delay: tp_delay_value,
					x: (tp_fade_direction == "left" ? -tp_fade_offset : (tp_fade_direction == "right" ? tp_fade_offset : 0)),
					y: (tp_fade_direction == "top" ? -tp_fade_offset : (tp_fade_direction == "bottom" ? tp_fade_offset : 0)),
			    };
			if (tp_onscroll_value == 1) {
				tp_anim_setting.scrollTrigger = {
					trigger: item,
					start: 'top 85%',
				};
			}
			gsap.from(item, tp_anim_setting);
		});
	}

    // char-animate
    gsap.utils.toArray(".char-animate-wrap").forEach((section) => {
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: section,
                start: "top 60%", 
                toggleActions: "play none none none"
            }
        });
        const animateMe = section.querySelectorAll(".char-animate");
        animateMe.forEach((chunk) => {
            const split = new SplitText(chunk, {
                type: "words",
                charsClass: "char",
                wordsClass: "word++"
            });
            tl.from(split.words, {
                autoAlpha: 0,
                duration: 1,
                stagger: 0.1,
            });
        });
    });

	// 18.Section to title zoom and item uper
	gsap.matchMedia().add("(min-width: 993px)", () => {
		const portfolioArea = document.querySelector(".portfolio-area");
		const portfolioText = document.querySelector(".portfolio-text");
		if (portfolioArea && portfolioText) {
			let portfolioline = gsap.timeline({
				scrollTrigger: {
					trigger: portfolioArea,
					start: "top center-=300",
					pin: portfolioText,
					end: "bottom bottom",
					markers: false,
                    pinSpacing: true,
                    anticipatePin: 1, 
					scrub: 3,
				}
			});
			portfolioline.to(portfolioText, { scale: 1, duration: 1 });
			portfolioline.to(portfolioText, { scale: 1.1, duration: 1 });
			portfolioline.to(portfolioText, { scale: 1.2, duration: 1 }, "+=2");
			// Opacity scroll animation
			gsap.to(portfolioText, {
				scrollTrigger: {
					trigger: portfolioArea,
					start: "top center-=300",
					end: "bottom bottom",
					scrub: 3
				},
				opacity: 0
			});
		}
	});

    // 51. zoom in //
	$(".anim-zoomin").each(function() {
		// Add wrap <div>.
		$(this).wrap('<div class="anim-zoomin-wrap"></div>');
		// Add overflow hidden.
		$(".anim-zoomin-wrap").css({ "overflow": "hidden" })

		let $this = $(this);
		let $asiWrap = $this.parents(".anim-zoomin-wrap");

		let tp_ZoomIn = gsap.timeline({
			scrollTrigger: {
				trigger: $asiWrap,
				start: "top 100%",
				markers: false,
			}
		});
		tp_ZoomIn.from($this, { duration: 2, autoAlpha: 0, scale: 1.2, ease: Power2.easeOut, clearProps:"all" });
	});

	// 27. carachter Animation //
	if ($('.tp-char-animation').length > 0) {
		let char_come = gsap.utils.toArray(".tp-char-animation");
		char_come.forEach(splitTextLine => {
			const tl = gsap.timeline({
				scrollTrigger: {
					trigger: splitTextLine,
					start: 'top 90%',
					end: 'bottom 60%',
					scrub: false,
					markers: false,
					toggleActions: 'play none none none'
				}
			});
			const itemSplitted = new SplitText(splitTextLine, { type: "chars, words" });
			gsap.set(splitTextLine, { perspective: 300 });
			itemSplitted.split({ type: "chars, words" })
			tl.from(itemSplitted.chars,
				{
					duration: 1,
					delay: 0.6,
					x: 100,
					autoAlpha: 0,
					stagger: 0.05
				});
		});
	}

    if (document.querySelector('.reval-line')) {
        document.querySelectorAll('.reval-line').forEach(function (el) {
            var split = new SplitText(el, {
            type      : 'lines,words,chars',
            linesClass: 'split-line'
            });
            gsap.set(split.chars, { opacity: 0.3, x: -7 });
            gsap.to(split.chars, {
            scrollTrigger: {
                trigger: el,
                start  : el.getAttribute('data-rt-start')  || 'top 80%',
                end    : el.getAttribute('data-rt-end')    || 'top 20%',
                toggleActions: 'play none none none',
                scrub  : 1,
                markers: false
            },
            x      : 0,
            opacity: 1,
            stagger: parseFloat(el.getAttribute('data-rt-stagger'))  || 0.2,
            duration: parseFloat(el.getAttribute('data-rt-duration')) || 0.7
            });
        });
    }

	// 54. tp-text-revel-anim //
	const tp_anim_reveal = document.querySelectorAll(".text-line-anim");
	tp_anim_reveal.forEach(areveal => {
		const getAttributeValue = (attr, defaultValue) => areveal.getAttribute(attr) || defaultValue;
		const duration_value = parseFloat(getAttributeValue("data-duration", 1));
		const onscroll_value = parseInt(getAttributeValue("data-on-scroll", 1));
		const stagger_value = parseFloat(getAttributeValue("data-stagger", 0.02));
		const data_delay = parseFloat(getAttributeValue("data-delay", 0.05));
		const ease_value = getAttributeValue("data-ease", "circ.out");

		areveal.split = new SplitText(areveal, { type: "lines,words,chars", linesClass: "tp-revel-line" });
		const animationProps = {
			duration: duration_value,
			delay: data_delay,
			ease: ease_value,
			y: 80,
			stagger: stagger_value,
			opacity: 0,
		};
		if (onscroll_value === 1) {
			areveal.anim = gsap.from(areveal.split.chars, {
				scrollTrigger: {
					trigger: areveal,
					start: 'top 80%',
				},
				...animationProps,
			});
		} else {
			areveal.anim = gsap.from(areveal.split.chars, animationProps);
		}
	});

})(jQuery);