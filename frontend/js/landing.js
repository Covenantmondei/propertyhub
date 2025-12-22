(function() {
    'use strict';

    // ================================
    // Mobile Menu Toggle
    // ================================
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // ================================
    // Smooth Scrolling for Anchor Links
    // ================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const headerOffset = 100;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ================================
    // Animated Counter for Stats Section
    // ================================
    function animateCounter(element, target, duration = 2000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                // Handle decimal numbers for percentage
                if (target < 100 && target % 1 !== 0) {
                    element.textContent = current.toFixed(1);
                } else {
                    element.textContent = Math.floor(current).toLocaleString();
                }
            }
        }, 16);
    }

    // Intersection Observer for Stats Animation
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        const statNumbers = statsSection.querySelectorAll('.stat-number');
        let hasAnimated = false;

        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !hasAnimated) {
                    hasAnimated = true;
                    statNumbers.forEach(stat => {
                        const target = parseFloat(stat.getAttribute('data-target'));
                        animateCounter(stat, target);
                    });
                }
            });
        }, { threshold: 0.5 });

        statsObserver.observe(statsSection);
    }

    // ================================
    // Documentation Section Card Rotation
    // ================================
    const docCards = document.querySelectorAll('.doc-card');
    const previewBoxes = document.querySelectorAll('.preview-box');
    let currentDocIndex = 0;
    let docRotationInterval;

    function activateDocCard(index) {
        // Remove active class from all cards and previews
        docCards.forEach(card => card.classList.remove('active'));
        previewBoxes.forEach(box => box.classList.remove('active'));
        
        // Add active class to selected card and preview
        if (docCards[index]) {
            docCards[index].classList.add('active');
        }
        if (previewBoxes[index]) {
            previewBoxes[index].classList.add('active');
        }
        
        currentDocIndex = index;
    }

    function startDocRotation() {
        docRotationInterval = setInterval(() => {
            currentDocIndex = (currentDocIndex + 1) % docCards.length;
            activateDocCard(currentDocIndex);
        }, 5000);
    }

    function stopDocRotation() {
        if (docRotationInterval) {
            clearInterval(docRotationInterval);
        }
    }

    // Add click handlers to doc cards
    docCards.forEach((card, index) => {
        card.addEventListener('click', () => {
            stopDocRotation();
            activateDocCard(index);
            startDocRotation();
        });
    });

    // Start automatic rotation
    if (docCards.length > 0) {
        startDocRotation();
    }

    // ================================
    // Testimonials Carousel
    // ================================
    const testimonialImages = document.querySelectorAll('.testimonial-img');
    const testimonialQuotes = document.querySelectorAll('.testimonial-quote');
    const testimonialAuthors = document.querySelectorAll('.testimonial-author');
    const navDots = document.querySelectorAll('.nav-dot');
    let currentTestimonialIndex = 0;
    let testimonialInterval;

    function activateTestimonial(index) {
        // Remove active class from all elements
        testimonialImages.forEach(img => img.classList.remove('active'));
        testimonialQuotes.forEach(quote => quote.classList.remove('active'));
        testimonialAuthors.forEach(author => author.classList.remove('active'));
        navDots.forEach(dot => dot.classList.remove('active'));
        
        // Add active class to selected elements
        if (testimonialImages[index]) testimonialImages[index].classList.add('active');
        if (testimonialQuotes[index]) testimonialQuotes[index].classList.add('active');
        if (testimonialAuthors[index]) testimonialAuthors[index].classList.add('active');
        if (navDots[index]) navDots[index].classList.add('active');
        
        currentTestimonialIndex = index;
    }

    function startTestimonialRotation() {
        testimonialInterval = setInterval(() => {
            currentTestimonialIndex = (currentTestimonialIndex + 1) % testimonialImages.length;
            activateTestimonial(currentTestimonialIndex);
        }, 12000); // 12 seconds
    }

    function stopTestimonialRotation() {
        if (testimonialInterval) {
            clearInterval(testimonialInterval);
        }
    }

    // Add click handlers to navigation dots
    navDots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            stopTestimonialRotation();
            activateTestimonial(index);
            startTestimonialRotation();
        });
    });

    // Start automatic rotation
    if (testimonialImages.length > 0) {
        startTestimonialRotation();
    }

    // ================================
    // FAQ Accordion
    // ================================
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                    const otherQuestion = otherItem.querySelector('.faq-question');
                    if (otherQuestion) {
                        otherQuestion.setAttribute('aria-expanded', 'false');
                    }
                }
            });
            
            // Toggle current item
            if (isActive) {
                item.classList.remove('active');
                question.setAttribute('aria-expanded', 'false');
            } else {
                item.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
            }
        });
    });

    // ================================
    // Pricing Toggle (Monthly/Annually)
    // ================================
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    const priceElements = document.querySelectorAll('.price');
    let currentBillingPeriod = 'annually';

    function updatePrices(period) {
        priceElements.forEach(priceEl => {
            const monthlyPrice = priceEl.getAttribute('data-monthly');
            const annuallyPrice = priceEl.getAttribute('data-annually');
            
            if (period === 'monthly') {
                if (monthlyPrice === '0') {
                    priceEl.textContent = 'Free';
                } else if (monthlyPrice) {
                    priceEl.textContent = 'NGN ' + parseInt(monthlyPrice).toLocaleString();
                }
            } else {
                if (annuallyPrice === '0') {
                    priceEl.textContent = 'Free';
                } else if (annuallyPrice) {
                    priceEl.textContent = 'NGN ' + parseInt(annuallyPrice).toLocaleString();
                }
            }
        });
    }

    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const period = button.getAttribute('data-period');
            
            // Update active state
            toggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update slider position
            const toggleContainer = button.parentElement;
            toggleContainer.setAttribute('data-period', period);
            
            // Update prices
            currentBillingPeriod = period;
            updatePrices(period);
        });
    });

    // ================================
    // Scroll Reveal Animation
    // ================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const fadeInObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Apply fade-in effect to sections
    const sections = document.querySelectorAll('.feature-section, .stats-section, .documentation-section, .testimonials-section, .faq-section, .pricing-section');
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        fadeInObserver.observe(section);
    });

    // ================================
    // Active Navigation Link on Scroll
    // ================================
    const navLinksArray = document.querySelectorAll('.nav-links a');
    const sectionsArray = document.querySelectorAll('section[id]');

    function setActiveNavLink() {
        const scrollPosition = window.scrollY + 150;

        sectionsArray.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinksArray.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + sectionId) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', setActiveNavLink);

    // ================================
    // Calendar Cards Float Animation
    // ================================
    const calendarCards = document.querySelectorAll('.calendar-card');
    calendarCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 1.5}s`;
    });

    // ================================
    // Integration Logos Pulse Animation
    // ================================
    const integrationLogos = document.querySelectorAll('.integration-logo');
    integrationLogos.forEach((logo, index) => {
        logo.style.animationDelay = `${index * 0.3}s`;
    });

    // ================================
    // Resize Handler for Responsive Adjustments
    // ================================
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Add any responsive adjustments here if needed
        }, 250);
    });

    // ================================
    // Initialize on DOM Load
    // ================================
    console.log('PrimeSpace Landing Page - Loaded Successfully');
    
})();
