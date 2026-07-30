import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
	{
		eventCoverUrl: {
			type: String,
			default: null,
		},
		eventCoverPublicId: {
			type: String,
			default: null,
		},
		isRegistrationOpen: {
			type: Boolean,
			default: true,
		},
		eventName: {
			type: String,
			default: "",
		},
		eventAddress: {
			type: String,
			default: "",
		},
		eventDate: {
			type: String,
			default: "",
		},
		eventStartTime: {
			type: String,
			default: "",
		},
		organiserContact: {
			type: String,
			default: "",
		},
		showCountdown: {
			type: Boolean,
			default: true,
		},
		// Signature & Authority Config
		presidentName: {
			type: String,
			default: "President",
		},
		presidentTitle: {
			type: String,
			default: "President, Chhatak Uttar",
		},
		presidentSignatureUrl: {
			type: String,
			default: "",
		},
		presidentSignaturePublicId: {
			type: String,
			default: "",
		},
		secretaryName: {
			type: String,
			default: "General Secretary",
		},
		secretaryTitle: {
			type: String,
			default: "General Secretary, Chhatak Uttar",
		},
		secretarySignatureUrl: {
			type: String,
			default: "",
		},
		secretarySignaturePublicId: {
			type: String,
			default: "",
		},
		fieldConfig: {
			type: mongoose.Schema.Types.Mixed,
			default: {
				email: false,
				dob: false,
				fatherName: false,
				rollNumber: false,
				regNumber: false,
				bloodGroup: false,
				emergencyContact: false,
				passingYear: false,
				gradeGpa: false,
			},
		},
		// Homepage Section Visibility Toggles
		showHeroSection: { type: Boolean, default: true },
		showAboutSection: { type: Boolean, default: true },
		showStatsSection: { type: Boolean, default: true },
		showEventsSection: { type: Boolean, default: true },
		showGallerySection: { type: Boolean, default: true },
		showBlogSection: { type: Boolean, default: true },
		showTeamSection: { type: Boolean, default: true },
		showContactSection: { type: Boolean, default: true },
		showFooter: { type: Boolean, default: true },

		// Homepage Hero Section Content
		heroEyebrow: { type: String, default: "Chhatak Uttar Upazila" },
		heroTitleLine1: { type: String, default: "Bangladesh Anjumane" },
		heroTitleLine2: { type: String, default: "Talamije Islamia" },
		heroDescription: { type: String, default: "Dedicated to fostering education, ethical values, leadership skills, and community welfare among students and youth." },
		heroCtaRegisterText: { type: String, default: "Register for Event" },
		heroCtaAboutText: { type: String, default: "Learn About Us" },
		heroCtaEventsText: { type: String, default: "View All Events" },

		// Homepage About Section Content
		aboutBadge: { type: String, default: "About Us" },
		aboutTitle: { type: String, default: "Talamij — A Journey of Dreams" },
		aboutParagraph1: { type: String, default: "Talamij is a voluntary organization working to develop the talents of young students, cultivate leadership skills, and foster a sense of social responsibility. We believe every young person holds limitless potential within them." },
		aboutParagraph2: { type: String, default: "Through the combination of quality education, good health, and rich culture, we aim to build an enlightened generation devoted to serving their country and nation." },
		aboutFoundedYear: { type: String, default: "2018" },
		aboutMissionText: { type: String, default: "Guiding talented youth on the right path to contribute to the nation's development." },
		aboutVisionText: { type: String, default: "Building an educated, aware, and well-organized generation of young people." },
		aboutValuesText: { type: String, default: "Honesty, unity, dedication, and patriotism are our core driving forces." },
		aboutInnovationText: { type: String, default: "Opening doors to new possibilities through the integration of education and technology." },

		// Homepage Stats Section Content
		statsMembers: { type: String, default: "5000+" },
		statsEvents: { type: String, default: "48+" },
		statsYears: { type: String, default: "6+" },
		statsDistricts: { type: String, default: "12" },

		// Homepage Section Titles & Subtitles
		eventsSectionTitle: { type: String, default: "Upcoming Events" },
		eventsSectionSubtitle: { type: String, default: "Join our upcoming educational, cultural, and Islamic events." },
		gallerySectionTitle: { type: String, default: "Photo Gallery" },
		gallerySectionSubtitle: { type: String, default: "Highlights of our past events, seminars, and activities." },
		blogSectionTitle: { type: String, default: "Latest News & Blogs" },
		blogSectionSubtitle: { type: String, default: "Stay updated with our latest news, articles, and announcements." },
		teamSectionTitle: { type: String, default: "Our Leaders" },
		teamSectionSubtitle: { type: String, default: "The dedicated leadership guiding our organization with vision and integrity." },
		contactSectionTitle: { type: String, default: "Get in Touch" },
		contactSectionSubtitle: { type: String, default: "For any questions, suggestions, or collaboration opportunities, write to us or reach out directly." },

		// Site Branding & Navbar Logo
		navbarLogoUrl: { type: String, default: "" },
		navbarLogoPublicId: { type: String, default: "" },
		siteTitle: { type: String, default: "Talamije Islamia" },
		siteSubtitle: { type: String, default: "Chhatak Uttar Upazila" },

		// Dedicated About Page Content
		aboutHeroBadge: { type: String, default: "About Us" },
		aboutHeroTitle: { type: String, default: "Talamij — A Journey of Dreams" },
		aboutHeroSubtitle: { type: String, default: "A non-profit organization dedicated to youth talent development, leadership building, and fostering social responsibility." },
		aboutMissionTitle: { type: String, default: "Our Mission" },
		aboutMissionDetail: { type: String, default: "Guiding talented youth on the right path to contribute to national development. Inspiring youth participation in education, culture, and social development." },
		aboutVisionTitle: { type: String, default: "Our Vision" },
		aboutVisionDetail: { type: String, default: "Building an educated, conscious, and organized youth generation — advancing the country toward a bright future with knowledge, ethics, and humanity." },
		aboutPromiseTitle: { type: String, default: "Our Promise" },
		aboutPromiseDetail: { type: String, default: "Giving every young person the opportunity to develop their full potential. Creating an enlightened generation through quality education, health, and culture." },
		aboutHistoryStory: { type: String, default: "Talamij is a voluntary organization working to develop the talents of young students, cultivate leadership skills, and foster a sense of social responsibility. We believe every young person holds limitless potential within them." },
		aboutCoverUrl: { type: String, default: "" },
		aboutCoverPublicId: { type: String, default: "" },

		// About Page — History / Journey Section
		aboutHistorySectionBadge: { type: String, default: "Our History" },
		aboutHistorySectionTitle: { type: String, default: "Talamij's Journey" },
		aboutMilestones: {
			type: [
				{
					year: { type: String, default: "" },
					title: { type: String, default: "" },
					description: { type: String, default: "" },
					color: { type: String, default: "#7c3aed" },
				}
			],
			default: [
				{ year: "2018", title: "Foundation", description: "Talamij Organization officially began its journey in Chhatok North, Sunamganj. The founders envisioned a structured platform for youth talent development.", color: "#7c3aed" },
				{ year: "2019", title: "First Medha Jahai", description: "The first 'Medha Jahai Competition' was held with over 150 student participants, becoming Talamij's flagship annual event.", color: "#0ea5e9" },
				{ year: "2021", title: "District Expansion", description: "Talamij activities expanded across 6 sub-districts of Sunamganj. Membership crossed 1,000 with a dedicated volunteer team.", color: "#f59e0b" },
				{ year: "2023", title: "Inter-District Activities", description: "Outreach extended to multiple districts in the Sylhet division. Over 500 young leaders joined the Youth Leadership Summit.", color: "#10b981" },
				{ year: "2024", title: "Digital Transformation", description: "Launched online registration, digital certificates, and organization web portal to reach and empower more youth.", color: "#ec4899" },
			],
		},

		// About Page — Core Principles / Values Section
		aboutPrinciplesSectionBadge: { type: String, default: "Values" },
		aboutPrinciplesSectionTitle: { type: String, default: "Our Core Principles" },
		aboutPrinciplesSectionSubtitle: { type: String, default: "These core principles drive every decision and activity at Talamij." },
		aboutCoreValues: {
			type: [
				{
					title: { type: String, default: "" },
					description: { type: String, default: "" },
					color: { type: String, default: "#7c3aed" },
				}
			],
			default: [
				{ title: "Integrity & Transparency", description: "Maintaining honesty, accountability, and transparency in every activity of our organization.", color: "#7c3aed" },
				{ title: "Humanity & Service", description: "Dedicated to human welfare to build a compassionate and responsible society.", color: "#ec4899" },
				{ title: "Unity & Collaboration", description: "Fostering strong community ties by respecting diverse perspectives and working together.", color: "#0ea5e9" },
				{ title: "Innovation & Creativity", description: "Pioneering new paths in education and development through technology and creative thinking.", color: "#f59e0b" },
				{ title: "Knowledge & Education", description: "Commitment to lifelong learning and creating knowledge opportunities beyond traditional curricula.", color: "#10b981" },
				{ title: "Patriotism & Responsibility", description: "Pledging to build a prosperous nation through civic duty and social responsibility.", color: "#8b5cf6" },
			],
		},

		// About Page — Executive Board Section
		aboutBoardSectionBadge: { type: String, default: "Leadership" },
		aboutBoardSectionTitle: { type: String, default: "Our Executive Board" },
		aboutBoardMembers: {
			type: [
				{
					name: { type: String, default: "" },
					title: { type: String, default: "" },
					role: { type: String, default: "" },
					photoUrl: { type: String, default: "" },
					photoPublicId: { type: String, default: "" },
					accent: { type: String, default: "#7c3aed" },
				}
			],
			default: [],
		},

		// About Page — Join CTA Section
		aboutJoinTitle: { type: String, default: "Join Our Organization" },
		aboutJoinSubtitle: { type: String, default: "Become part of the growing Talamij family. Together, let's build an enlightened generation and a better tomorrow." },
		aboutJoinEventsButtonText: { type: String, default: "View Events" },
		aboutJoinContactButtonText: { type: String, default: "Contact Us" },

		// Dedicated Events Page Content
		eventsPageBadge: { type: String, default: "Our Activities" },
		eventsPageTitle: { type: String, default: "Events & Programs" },
		eventsPageSubtitle: { type: String, default: "Explore our past, current, and upcoming educational, cultural, and leadership programs." },
		upcomingEventNotice: { type: String, default: "Registration is open! Click register to submit your details and get your electronic ticket." },
		noEventMessage: { type: String, default: "There is currently no active event registration open. Stay tuned for upcoming announcements!" },

		// Dedicated Gallery Page Content
		galleryPageBadge: { type: String, default: "Official Gallery" },
		galleryPageTitle: { type: String, default: "Our Photos & Memories" },
		galleryPageSubtitle: { type: String, default: "Moments from Talamij's various events, workshops, and community activities." },

		// Dedicated Blog Page Content
		blogPageBadge: { type: String, default: "Articles & News" },
		blogPageTitle: { type: String, default: "Latest Blogs & Stories" },
		blogPageSubtitle: { type: String, default: "Discover stories, event updates, educational insights, and Islamic guidance." },

		// Registration Form Left Panel Content
		regFormOrgLine1: { type: String, default: "Bangladesh Anjumane Talamije Islamia" },
		regFormOrgLine2: { type: String, default: "Chhatak Uttar Upazila" },
		regFormHeadingLine1: { type: String, default: "Register &" },
		regFormHeadingLine2: { type: String, default: "Get Your" },
		regFormHeadingHighlight: { type: String, default: "Digital Ticket" },
		regFormDescription: { type: String, default: "Fill out the form to secure your spot. You'll receive a unique QR-verified ticket instantly." },
		regFormFeature1: { type: String, default: "Academic Excellence" },
		regFormFeature2: { type: String, default: "Health & Safety" },
		regFormFeature3: { type: String, default: "Multi-Subject Programs" },

		// Success Page & Ticket Content
		successPageTitle: { type: String, default: "Registration Successful!" },
		successPageSubtitle: { type: String, default: "Your digital ticket is ready. Please save or print it." },
		ticketParticipantLabel: { type: String, default: "Participant Ticket" },

		// Certificate Custom Text & Logo Controls
		certMainTitle: { type: String, default: "Certificate of Participation" },
		certSubTitlePrefix: { type: String, default: "This is to certify that" },
		certBodyText: { type: String, default: "successfully registered and participated in the event" },
		certSecurityLabel: { type: String, default: "Official Security Verification" },
		certShowBismillah: { type: Boolean, default: true },
		certBismillahText: { type: String, default: "﷽" },
		certTopLogoUrl: { type: String, default: "" },
		certTopLogoPublicId: { type: String, default: "" },
		watermarkUrl: { type: String, default: "" },
		watermarkPublicId: { type: String, default: "" },
		// Homepage Contact & Footer Info
		contactEmail: { type: String, default: "contact@talamij.org" },
		footerDescription: { type: String, default: "Bangladesh Anjumane Talamije Islamia, Chhatak Uttar Upazila branch. Dedicated to educational excellence, moral values, and youth leadership." },
		footerCopyrightText: { type: String, default: "" },
		footerFacebookUrl: { type: String, default: "#" },
		footerYoutubeUrl: { type: String, default: "#" },
		footerWebsiteUrl: { type: String, default: "#" },
	},
	{ timestamps: true }
);

const Settings =
	mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

export default Settings;
