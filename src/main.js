import { setupIntro } from './intro.js';
import { setupWorkScroll } from './work-scroll.js';
import { setupChoreography } from './choreography.js';
import { setupProjects, setupBrief } from './interactions.js';
import { setupMotion } from './motion.js';

setupProjects();
setupBrief();
setupMotion();
setupChoreography();
setupWorkScroll();
setupIntro();
