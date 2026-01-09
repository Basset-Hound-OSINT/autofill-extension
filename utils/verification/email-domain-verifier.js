/**
 * Basset Hound Browser Automation - Email & Domain Verifier
 * Enhanced Email and Domain Validation Module
 *
 * Provides comprehensive verification capabilities:
 * - MX record verification via DNS over HTTPS (Google DNS API)
 * - SPF and DMARC record checking
 * - Domain reputation and age estimation
 * - Enhanced disposable email detection with pattern matching
 * - Typo detection and correction for common email domains
 * - Integration with existing DataVerifier
 *
 * @module EmailDomainVerifier
 * @version 1.0.0
 */

// =============================================================================
// Configuration
// =============================================================================

const EMAIL_VERIFIER_CONFIG = {
  // DNS over HTTPS endpoints (no API key required)
  DNS_API: {
    GOOGLE: 'https://dns.google/resolve',
    CLOUDFLARE: 'https://cloudflare-dns.com/dns-query'
  },

  // Cache configuration
  CACHE: {
    DNS_TTL: 3600000,      // 1 hour for DNS results
    REPUTATION_TTL: 86400000, // 24 hours for reputation data
    MAX_ENTRIES: 1000
  },

  // Request timeout in milliseconds
  TIMEOUT: 10000,

  // DNS record types
  DNS_TYPES: {
    A: 1,
    NS: 2,
    CNAME: 5,
    MX: 15,
    TXT: 16,
    AAAA: 28
  }
};

// =============================================================================
// Extended Disposable Email Domains List
// =============================================================================

/**
 * Comprehensive list of known disposable email domains
 * Organized by category for easier maintenance
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  // Popular temporary mail services
  'tempmail.com', 'temp-mail.org', '10minutemail.com', '10minutemail.net',
  'guerrillamail.com', 'guerrillamail.org', 'guerrillamail.net', 'guerrillamail.biz',
  'guerrillamailblock.com', 'sharklasers.com', 'grr.la', 'spam4.me',
  'mailinator.com', 'mailinator.net', 'mailinator2.com', 'mailinater.com',
  'throwaway.email', 'throwawaymail.com', 'throam.com',
  'fakeinbox.com', 'tempinbox.com', 'fakemailgenerator.com',
  'getnada.com', 'nada.email', 'tempail.com',
  'mohmal.com', 'mohmal.im', 'mohmal.tech',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'cool.fr.nf', 'jetable.fr.nf',
  'trashmail.com', 'trashmail.net', 'trashmail.org', 'trashmail.me',
  'mailnesia.com', 'mailnesia.net',
  'emailondeck.com', 'dropmail.me',
  'temporary-mail.net', 'mintemail.com',
  'bouncr.com', 'maildrop.cc',
  'tempmailaddress.com', 'tempmailo.com',
  'disposableemailaddresses.com', 'anonymousemail.me',
  'spamgourmet.com', 'spamgourmet.net',
  'getairmail.com', 'airmail.cc',
  'tempr.email', 'spambox.us',
  'mailcatch.com', 'tempsky.com',
  'trashemail.de', 'wegwerfemail.de',
  'emailtemporanea.com', 'mybx.site',
  'discard.email', 'discardmail.com',

  // Additional temporary mail services
  'mailforspam.com', 'spamfree24.org', 'spamfree24.de',
  'receivemail.com', 'recievemails.com',
  'hidemail.de', 'hidemail.pro',
  'fastacura.com', 'fastchevy.com', 'fastchrysler.com',
  'crazymailing.com', 'crazymailing.de',
  'emailsensei.com', 'email-jetable.fr',
  'email-temp.com', 'emailtmp.com',
  'emlhub.com', 'emlpro.com',
  'emltmp.com', 'emltmp.net',
  'fakemailgenerator.net', 'fakemailgenerator.org',
  'getonemail.com', 'getonemail.net',
  'haltospam.com', 'hatespam.org',
  'incognitomail.com', 'incognitomail.net', 'incognitomail.org',
  'inboxalias.com', 'inboxbear.com', 'inboxclean.com', 'inboxclean.org',
  'instantemailaddress.com', 'instantmail.fr',
  'jetable.com', 'jetable.net', 'jetable.org',
  'junk-mail.me', 'junkmail.ga', 'junkmail.gq',
  'kasmail.com', 'keepmail.info',
  'kurzepost.de', 'kurzepost.net',
  'lifetimemail.com', 'link2mail.net',
  'mailcatch.net', 'mailchop.com',
  'mailexpire.com', 'mailfa.tk',
  'mailfreeonline.com', 'mailguard.me',
  'mailimate.com', 'mailismagic.com',
  'mailmate.com', 'mailme24.com',
  'mailmetrash.com', 'mailmoat.com',
  'mailnator.com', 'mailnesia.org',
  'mailnull.com', 'mailpick.biz',
  'mailquack.com', 'mailrock.biz',
  'mailsac.com', 'mailscrap.com',
  'mailseal.de', 'mailshell.com',
  'mailsiphon.com', 'mailslapping.com',
  'mailslite.com', 'mailspeed.biz',
  'mailtemp.info', 'mailtothis.com',
  'mailzilla.com', 'mailzilla.org',
  'mbx.cc', 'mega.zik.dj',
  'meltmail.com', 'messagebeamer.de',
  'mezimages.net', 'mierdamail.com',
  'minumail.com', 'moncourrier.fr.nf',
  'monemail.fr.nf', 'monmail.fr.nf',
  'mt2009.com', 'mx0.wwwnew.eu',
  'mynetstore.de', 'myspaceinc.com',
  'myspaceinc.net', 'myspacepimpedup.com',
  'mytempemail.com', 'mytempmail.com',
  'nervmich.net', 'nervtmich.net',
  'netmails.com', 'netmails.net',
  'netzidiot.de', 'neverbox.com',
  'no-spam.ws', 'nobulk.com',
  'noclickemail.com', 'nogmailspam.info',
  'nomail.xl.cx', 'nomail2me.com',
  'nomorespamemails.com', 'nospam.ze.tc',
  'nospam4.us', 'nospamfor.us',
  'nospammail.net', 'nospamthanks.info',
  'notmailinator.com', 'nowmymail.com',
  'nurfuerspam.de', 'nus.edu.sg',
  'objectmail.com', 'obobbo.com',
  'odnorazovoe.ru', 'ohaaa.de',
  'onewaymail.com', 'online.ms',
  'oopi.org', 'opayq.com',
  'ordinaryamerican.net', 'otherinbox.com',
  'ourklips.com', 'outlawspam.com',
  'ovpn.to', 'owlpic.com',
  'pancakemail.com', 'pcusers.otherinbox.com',
  'pjjkp.com', 'plexolan.de',
  'poczta.onet.pl', 'politikerclub.de',
  'poofy.org', 'pookmail.com',
  'privacy.net', 'privatdemail.net',
  'privy-mail.com', 'privymail.de',
  'proxymail.eu', 'prtnx.com',
  'punkass.com', 'putthisinyourspamdatabase.com',
  'pwrby.com', 'qasti.com',
  'quickinbox.com', 'quickmail.nl',
  'rainmail.biz', 'rcpt.at',
  'reallymymail.com', 'receiveee.chickenkiller.com',
  'reconmail.com', 'recursor.net',
  'recyclemail.dk', 'regbypass.com',
  'regbypass.comsafe-mail.net', 'rejectmail.com',
  'reliable-mail.com', 'remail.cf',
  'remail.ga', 'rhyta.com',
  'rklips.com', 'rmqkr.net',
  'royal.net', 'rppkn.com',
  'rtrtr.com', 's0ny.net',
  'safe-mail.net', 'safersignup.de',
  'safetymail.info', 'safetypost.de',
  'sandelf.de', 'saynotospams.com',
  'schafmail.de', 'schrott-email.de',
  'secretemail.de', 'secure-mail.biz',
  'selfdestructingmail.com', 'selfdestructivemail.com',
  'sendspamhere.com', 'senseless-entertainment.com',
  'sharedmailbox.org', 'shieldemail.com',
  'shiftmail.com', 'shitaway.cf',
  'shitaway.cu.cc', 'shitaway.ga',
  'shitaway.gq', 'shitaway.ml',
  'shitaway.tk', 'shitmail.de',
  'shitmail.me', 'shitmail.org',
  'sinnlos-mail.de', 'siteposter.net',
  'skeefmail.com', 'slaskpost.se',
  'slopsbox.com', 'smashmail.de',
  'smellfear.com', 'snakemail.com',
  'sneakemail.com', 'sneakmail.de',
  'snkmail.com', 'sofimail.com',
  'sofort-mail.de', 'sogetthis.com',
  'sohu.com', 'solvemail.info',
  'soodonims.com', 'spam.la',
  'spam.su', 'spam4.me',
  'spamavert.com', 'spambob.com',
  'spambob.net', 'spambob.org',
  'spambog.com', 'spambog.de',
  'spambog.net', 'spambog.ru',
  'spambox.info', 'spambox.irishspringrealty.com',
  'spambox.us', 'spamcannon.com',
  'spamcannon.net', 'spamcero.com',
  'spamcon.org', 'spamcorptastic.com',
  'spamcowboy.com', 'spamcowboy.net',
  'spamcowboy.org', 'spamday.com',
  'spamex.com', 'spamfree.eu',
  'spamfree24.com', 'spamfree24.info',
  'spamgoes.in', 'spamherelots.com',
  'spamhereplease.com', 'spamhole.com',
  'spamify.com', 'spaminator.de',
  'spamkill.info', 'spaml.com',
  'spaml.de', 'spammotel.com',
  'spamobox.com', 'spamoff.de',
  'spamsalad.in', 'spamslicer.com',
  'spamspot.com', 'spamstack.net',
  'spamthis.co.uk', 'spamtroll.net',
  'speed.1s.fr', 'spoofmail.de',
  'squizzy.de', 'ssoia.com',
  'startkeys.com', 'stinkefinger.net',
  'stop-my-spam.cf', 'stop-my-spam.com',
  'stop-my-spam.ga', 'stop-my-spam.ml',
  'stop-my-spam.tk', 'streetwisemail.com',
  'stuffmail.de', 'supergreatmail.com',
  'supermailer.jp', 'superrito.com',
  'superstachel.de', 'suremail.info',
  'svk.jp', 'sweetxxx.de',
  'tafmail.com', 'tagyourself.com',
  'talkinator.com', 'tapchicuoihoi.com',
  'teewars.org', 'teleosaurs.xyz',
  'temp-mail.de', 'temp-mail.pp.ua',
  'temp-mail.ru', 'temp.emeraldwebmail.com',
  'temp.headstrong.de', 'tempail.com',
  'tempalias.com', 'tempe-mail.com',
  'tempemail.biz', 'tempemail.co.za',
  'tempemail.com', 'tempemail.net',
  'tempinbox.co.uk', 'tempinbox.net',
  'tempmail.co', 'tempmail.de',
  'tempmail.eu', 'tempmail.it',
  'tempmail.net', 'tempmail.pro',
  'tempmail.us', 'tempmail2.com',
  'tempmaildemo.com', 'tempmailer.com',
  'tempmailer.de', 'tempmailid.com',
  'tempomail.fr', 'temporarily.de',
  'temporarioemail.com.br', 'temporaryemail.net',
  'temporaryemail.us', 'temporaryforwarding.com',
  'temporaryinbox.com', 'temporarymailaddress.com',
  'tempthe.net', 'thanksnospam.info',
  'thankyou2010.com', 'thecloudindex.com',
  'thelimestones.com', 'thisisnotmyrealemail.com',
  'thismail.net', 'thisurl.website',
  'throam.com', 'throwam.com',
  'throwawayemailaddress.com', 'throwawaymail.com',
  'tilien.com', 'tittbit.in',
  'tmailinator.com', 'tmail.ws',
  'tokem.co', 'tokenmail.de',
  'tonymanso.com', 'toomail.biz',
  'topcoolemail.com', 'topmail-files.de',
  'topranklist.de', 'tormail.net',
  'tormail.org', 'tradermail.info',
  'trash-amil.com', 'trash-mail.at',
  'trash-mail.com', 'trash-mail.de',
  'trash-mail.gq', 'trash2009.com',
  'trash2010.com', 'trash2011.com',
  'trashbox.eu', 'trashcanmail.com',
  'trashdevil.com', 'trashdevil.de',
  'trashemail.de', 'trashmail.at',
  'trashmail.de', 'trashmail.in',
  'trashmail.io', 'trashmail.me',
  'trashmail.net', 'trashmail.org',
  'trashmail.ws', 'trashmailer.com',
  'trashymail.com', 'trashymail.net',
  'trbvm.com', 'trbvn.com',
  'trialmail.de', 'trickmail.net',
  'trillianpro.com', 'tryalert.com',
  'turual.com', 'twinmail.de',
  'tyldd.com', 'ubismail.net',
  'uggsrock.com', 'umail.net',
  'upliftnow.com', 'uplipht.com',
  'uroid.com', 'us.af',
  'valemail.net', 'venompen.com',
  'veryrealemail.com', 'viditag.com',
  'viewcastmedia.com', 'viewcastmedia.net',
  'viewcastmedia.org', 'viralplays.com',
  'vkcode.ru', 'vomoto.com',
  'vubby.com', 'w3internet.co.uk',
  'walala.org', 'walkmail.net',
  'watchever.biz', 'webemail.me',
  'webm4il.info', 'webuser.in',
  'wee.my', 'weg-werf-email.de',
  'wegwerf-email-addressen.de', 'wegwerf-emails.de',
  'wegwerfadresse.de', 'wegwerfemail.com',
  'wegwerfemail.de', 'wegwerfmail.de',
  'wegwerfmail.info', 'wegwerfmail.net',
  'wegwerfmail.org', 'wetrainbayarea.com',
  'wetrainbayarea.org', 'wh4f.org',
  'whatiaas.com', 'whatpaas.com',
  'whopy.com', 'whtjddn.33mail.com',
  'whyspam.me', 'willhackforfood.biz',
  'willselfdestruct.com', 'winemaven.info',
  'wolfsmail.tk', 'wollan.info',
  'worldspace.link', 'writeme.us',
  'wronghead.com', 'wuzup.net',
  'wuzupmail.net', 'wwwnew.eu',
  'x.ip6.li', 'xagloo.co',
  'xagloo.com', 'xemaps.com',
  'xents.com', 'xmaily.com',
  'xoxy.net', 'xww.ro',
  'yapped.net', 'yep.it',
  'yogamaven.com', 'yopmail.pp.ua',
  'yourdomain.com', 'ypmail.webarnak.fr.eu.org',
  'yuurok.com', 'zehnminutenmail.de',
  'zetmail.com', 'zippymail.info',
  'zoaxe.com', 'zoemail.com',
  'zoemail.net', 'zoemail.org',
  'zomg.info', 'zumpul.com',
  'zxcv.com', 'zxcvbnm.com',
  'zzz.com'
]);

/**
 * Patterns for detecting disposable email addresses
 * These patterns match common naming conventions used by temp mail services
 */
const DISPOSABLE_EMAIL_PATTERNS = [
  /^temp[._-]?mail/i,
  /^throw[._-]?away/i,
  /^disposable/i,
  /^fake[._-]?mail/i,
  /^spam[._-]?/i,
  /^trash[._-]?mail/i,
  /^junk[._-]?mail/i,
  /^burner[._-]?/i,
  /^anonymous[._-]?mail/i,
  /^\d+minute(s)?mail/i,
  /^guerrilla/i,
  /^mailinator/i,
  /^yopmail/i,
  /^tempinbox/i,
  /^getairmail/i,
  /mail[._-]?temp/i,
  /temp[._-]?inbox/i,
  /one[._-]?time[._-]?mail/i,
  /^no[._-]?spam/i,
  /^hide[._-]?mail/i
];

// =============================================================================
// Common Email Domain Typos
// =============================================================================

/**
 * Common typos for popular email providers with corrections
 */
const EMAIL_TYPO_CORRECTIONS = {
  // Gmail typos
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmali.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.cim': 'gmail.com',
  'gmail.vom': 'gmail.com',
  'gmail.xom': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gimail.com': 'gmail.com',
  'hmail.com': 'gmail.com',
  'fmail.com': 'gmail.com',
  'g.mail.com': 'gmail.com',
  'gmailcom': 'gmail.com',
  'gmsil.com': 'gmail.com',
  'gmaio.com': 'gmail.com',
  'gmaikl.com': 'gmail.com',
  'gamail.com': 'gmail.com',
  'gmaile.com': 'gmail.com',

  // Yahoo typos
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.cm': 'yahoo.com',
  'yaoo.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'yhoo.com': 'yahoo.com',
  'yahooe.com': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'yahou.com': 'yahoo.com',
  'yahaoo.com': 'yahoo.com',
  'yahho.com': 'yahoo.com',
  'ymail.co': 'ymail.com',
  'ymail.con': 'ymail.com',

  // Hotmail typos
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmail.cm': 'hotmail.com',
  'hotmeil.com': 'hotmail.com',
  'hotomail.com': 'hotmail.com',
  'homail.com': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmaul.com': 'hotmail.com',
  'hotmsil.com': 'hotmail.com',
  'hotmqil.com': 'hotmail.com',
  'hotmakl.com': 'hotmail.com',

  // Outlook typos
  'outloo.com': 'outlook.com',
  'outlok.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'outlook.cm': 'outlook.com',
  'outllook.com': 'outlook.com',
  'outlool.com': 'outlook.com',
  'outolok.com': 'outlook.com',
  'outlookk.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outlok.co': 'outlook.com',
  'oulook.com': 'outlook.com',
  'otlook.com': 'outlook.com',
  'outluk.com': 'outlook.com',

  // Live typos
  'live.co': 'live.com',
  'live.con': 'live.com',
  'live.cm': 'live.com',
  'lve.com': 'live.com',
  'liv.com': 'live.com',

  // iCloud typos
  'icloud.co': 'icloud.com',
  'icloud.con': 'icloud.com',
  'icloud.cm': 'icloud.com',
  'iclouod.com': 'icloud.com',
  'iclould.com': 'icloud.com',
  'iclod.com': 'icloud.com',
  'icould.com': 'icloud.com',

  // AOL typos
  'aol.co': 'aol.com',
  'aol.con': 'aol.com',
  'aol.cm': 'aol.com',
  'aoll.com': 'aol.com',
  'al.com': 'aol.com',

  // ProtonMail typos
  'protonmail.co': 'protonmail.com',
  'protonmail.con': 'protonmail.com',
  'protonmal.com': 'protonmail.com',
  'protnmail.com': 'protonmail.com',
  'protonmial.com': 'protonmail.com',

  // Common TLD typos
  '.ocm': '.com',
  '.cmo': '.com',
  '.vom': '.com',
  '.xom': '.com',
  '.cpm': '.com',
  '.coim': '.com',
  '.copm': '.com'
};

// =============================================================================
// DNS Cache
// =============================================================================

/**
 * Simple time-based cache for DNS results
 */
class DNSCache {
  constructor(maxEntries = EMAIL_VERIFIER_CONFIG.CACHE.MAX_ENTRIES) {
    this.cache = new Map();
    this.maxEntries = maxEntries;
  }

  /**
   * Get cached value if not expired
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in ms
   * @returns {*} Cached value or undefined
   */
  get(key, ttl = EMAIL_VERIFIER_CONFIG.CACHE.DNS_TTL) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries
    };
  }
}

// =============================================================================
// EmailDomainVerifier Class
// =============================================================================

/**
 * Email and Domain Verifier
 * Provides comprehensive verification of email addresses and domains
 *
 * @class EmailDomainVerifier
 * @example
 * const verifier = new EmailDomainVerifier();
 * const result = await verifier.verifyEmail('user@example.com');
 */
class EmailDomainVerifier {
  /**
   * Create a new EmailDomainVerifier instance
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance for debug output
   * @param {boolean} options.useCache - Enable DNS caching (default: true)
   * @param {string} options.dnsProvider - DNS provider: 'google' or 'cloudflare' (default: 'google')
   * @param {number} options.timeout - Request timeout in ms (default: 10000)
   * @param {string} options.virusTotalApiKey - VirusTotal API key for reputation checks
   * @param {string} options.safeBrowsingApiKey - Google Safe Browsing API key
   */
  constructor(options = {}) {
    this.config = {
      logger: options.logger || null,
      useCache: options.useCache !== false,
      dnsProvider: options.dnsProvider || 'google',
      timeout: options.timeout || EMAIL_VERIFIER_CONFIG.TIMEOUT,
      virusTotalApiKey: options.virusTotalApiKey || null,
      safeBrowsingApiKey: options.safeBrowsingApiKey || null
    };

    this.cache = new DNSCache();

    this.stats = {
      totalVerifications: 0,
      mxChecks: 0,
      spfChecks: 0,
      dmarcChecks: 0,
      disposableDetections: 0,
      typoCorrections: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    this._log('EmailDomainVerifier initialized', this.config);
  }

  // ===========================================================================
  // Public Methods - MX Record Verification
  // ===========================================================================

  /**
   * Check MX records for a domain using DNS over HTTPS
   * Verifies if the domain can receive email
   *
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} MX record verification result
   * @example
   * const result = await verifier.checkMXRecords('gmail.com');
   * // Returns: { hasMX: true, records: [...], priority: {...} }
   */
  async checkMXRecords(domain) {
    this.stats.mxChecks++;

    const cleanDomain = this._cleanDomain(domain);
    if (!cleanDomain) {
      return this._createErrorResult('INVALID_DOMAIN', 'Invalid domain format');
    }

    // Check cache first
    const cacheKey = `mx:${cleanDomain}`;
    if (this.config.useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return { ...cached, cached: true };
      }
      this.stats.cacheMisses++;
    }

    try {
      const response = await this._dnsQuery(cleanDomain, 'MX');

      if (!response.Answer || response.Answer.length === 0) {
        const result = {
          success: true,
          domain: cleanDomain,
          hasMX: false,
          records: [],
          canReceiveEmail: false,
          message: 'No MX records found for domain'
        };

        if (this.config.useCache) {
          this.cache.set(cacheKey, result);
        }

        return result;
      }

      // Parse MX records
      const mxRecords = response.Answer
        .filter(record => record.type === EMAIL_VERIFIER_CONFIG.DNS_TYPES.MX)
        .map(record => {
          const parts = record.data.split(' ');
          return {
            priority: parseInt(parts[0], 10),
            exchange: parts[1]?.replace(/\.$/, '') || record.data,
            ttl: record.TTL
          };
        })
        .sort((a, b) => a.priority - b.priority);

      const result = {
        success: true,
        domain: cleanDomain,
        hasMX: true,
        records: mxRecords,
        primaryMX: mxRecords[0] || null,
        canReceiveEmail: mxRecords.length > 0,
        recordCount: mxRecords.length,
        message: `Found ${mxRecords.length} MX record(s)`
      };

      if (this.config.useCache) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      return this._createErrorResult('DNS_ERROR', `MX lookup failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // Public Methods - Email Authentication Records
  // ===========================================================================

  /**
   * Check SPF (Sender Policy Framework) records for a domain
   *
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} SPF record details
   * @example
   * const result = await verifier.checkSPF('gmail.com');
   */
  async checkSPF(domain) {
    this.stats.spfChecks++;

    const cleanDomain = this._cleanDomain(domain);
    if (!cleanDomain) {
      return this._createErrorResult('INVALID_DOMAIN', 'Invalid domain format');
    }

    const cacheKey = `spf:${cleanDomain}`;
    if (this.config.useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return { ...cached, cached: true };
      }
      this.stats.cacheMisses++;
    }

    try {
      const response = await this._dnsQuery(cleanDomain, 'TXT');

      if (!response.Answer) {
        const result = {
          success: true,
          domain: cleanDomain,
          hasSPF: false,
          record: null,
          parsed: null,
          message: 'No SPF record found'
        };

        if (this.config.useCache) {
          this.cache.set(cacheKey, result);
        }

        return result;
      }

      // Find SPF record among TXT records
      const spfRecord = response.Answer.find(record =>
        record.type === EMAIL_VERIFIER_CONFIG.DNS_TYPES.TXT &&
        record.data.toLowerCase().includes('v=spf1')
      );

      if (!spfRecord) {
        const result = {
          success: true,
          domain: cleanDomain,
          hasSPF: false,
          record: null,
          parsed: null,
          message: 'No SPF record found'
        };

        if (this.config.useCache) {
          this.cache.set(cacheKey, result);
        }

        return result;
      }

      // Parse SPF record
      const spfData = spfRecord.data.replace(/"/g, '');
      const parsed = this._parseSPF(spfData);

      const result = {
        success: true,
        domain: cleanDomain,
        hasSPF: true,
        record: spfData,
        parsed,
        ttl: spfRecord.TTL,
        message: 'SPF record found'
      };

      if (this.config.useCache) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      return this._createErrorResult('DNS_ERROR', `SPF lookup failed: ${error.message}`);
    }
  }

  /**
   * Check DMARC (Domain-based Message Authentication) records for a domain
   *
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} DMARC record details
   * @example
   * const result = await verifier.checkDMARC('gmail.com');
   */
  async checkDMARC(domain) {
    this.stats.dmarcChecks++;

    const cleanDomain = this._cleanDomain(domain);
    if (!cleanDomain) {
      return this._createErrorResult('INVALID_DOMAIN', 'Invalid domain format');
    }

    const cacheKey = `dmarc:${cleanDomain}`;
    if (this.config.useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return { ...cached, cached: true };
      }
      this.stats.cacheMisses++;
    }

    try {
      // DMARC records are at _dmarc.domain
      const dmarcDomain = `_dmarc.${cleanDomain}`;
      const response = await this._dnsQuery(dmarcDomain, 'TXT');

      if (!response.Answer) {
        const result = {
          success: true,
          domain: cleanDomain,
          hasDMARC: false,
          record: null,
          parsed: null,
          message: 'No DMARC record found'
        };

        if (this.config.useCache) {
          this.cache.set(cacheKey, result);
        }

        return result;
      }

      // Find DMARC record
      const dmarcRecord = response.Answer.find(record =>
        record.type === EMAIL_VERIFIER_CONFIG.DNS_TYPES.TXT &&
        record.data.toLowerCase().includes('v=dmarc1')
      );

      if (!dmarcRecord) {
        const result = {
          success: true,
          domain: cleanDomain,
          hasDMARC: false,
          record: null,
          parsed: null,
          message: 'No DMARC record found'
        };

        if (this.config.useCache) {
          this.cache.set(cacheKey, result);
        }

        return result;
      }

      // Parse DMARC record
      const dmarcData = dmarcRecord.data.replace(/"/g, '');
      const parsed = this._parseDMARC(dmarcData);

      const result = {
        success: true,
        domain: cleanDomain,
        hasDMARC: true,
        record: dmarcData,
        parsed,
        ttl: dmarcRecord.TTL,
        policy: parsed.p || 'none',
        message: `DMARC policy: ${parsed.p || 'none'}`
      };

      if (this.config.useCache) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      return this._createErrorResult('DNS_ERROR', `DMARC lookup failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // Public Methods - Domain Reputation
  // ===========================================================================

  /**
   * Check domain age and registration info via WHOIS patterns
   * Note: This provides an estimate based on available data
   *
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} Domain age estimation
   */
  async checkDomainAge(domain) {
    const cleanDomain = this._cleanDomain(domain);
    if (!cleanDomain) {
      return this._createErrorResult('INVALID_DOMAIN', 'Invalid domain format');
    }

    const cacheKey = `age:${cleanDomain}`;
    if (this.config.useCache) {
      const cached = this.cache.get(cacheKey, EMAIL_VERIFIER_CONFIG.CACHE.REPUTATION_TTL);
      if (cached) {
        this.stats.cacheHits++;
        return { ...cached, cached: true };
      }
      this.stats.cacheMisses++;
    }

    try {
      // Use RDAP to get domain registration data
      const tld = cleanDomain.split('.').pop().toLowerCase();
      const rdapData = await this._fetchRDAP(cleanDomain, tld);

      if (!rdapData) {
        return {
          success: true,
          domain: cleanDomain,
          ageEstimated: false,
          createdDate: null,
          ageInDays: null,
          ageCategory: 'unknown',
          message: 'Unable to determine domain age'
        };
      }

      // Extract registration date
      let createdDate = null;
      if (rdapData.events) {
        const registrationEvent = rdapData.events.find(e =>
          e.eventAction === 'registration' || e.eventAction === 'created'
        );
        if (registrationEvent) {
          createdDate = new Date(registrationEvent.eventDate);
        }
      }

      if (!createdDate) {
        return {
          success: true,
          domain: cleanDomain,
          ageEstimated: false,
          createdDate: null,
          ageInDays: null,
          ageCategory: 'unknown',
          message: 'Registration date not available'
        };
      }

      const now = new Date();
      const ageInDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
      const ageCategory = this._categorizeAge(ageInDays);

      const result = {
        success: true,
        domain: cleanDomain,
        ageEstimated: true,
        createdDate: createdDate.toISOString(),
        ageInDays,
        ageInYears: Math.floor(ageInDays / 365),
        ageCategory,
        riskLevel: ageInDays < 30 ? 'high' : ageInDays < 180 ? 'medium' : 'low',
        message: `Domain is ${ageInDays} days old (${ageCategory})`
      };

      if (this.config.useCache) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      return {
        success: true,
        domain: cleanDomain,
        ageEstimated: false,
        createdDate: null,
        ageInDays: null,
        ageCategory: 'unknown',
        error: error.message,
        message: 'Unable to determine domain age'
      };
    }
  }

  /**
   * Check domain reputation using VirusTotal (requires API key)
   *
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} Reputation result
   */
  async checkVirusTotalReputation(domain) {
    const cleanDomain = this._cleanDomain(domain);
    if (!cleanDomain) {
      return this._createErrorResult('INVALID_DOMAIN', 'Invalid domain format');
    }

    if (!this.config.virusTotalApiKey) {
      return {
        success: false,
        available: false,
        domain: cleanDomain,
        message: 'VirusTotal API key not configured'
      };
    }

    try {
      const response = await fetch(
        `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(cleanDomain)}`,
        {
          headers: {
            'x-apikey': this.config.virusTotalApiKey
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: true,
            available: true,
            domain: cleanDomain,
            found: false,
            message: 'Domain not found in VirusTotal database'
          };
        }
        throw new Error(`VirusTotal API error: ${response.status}`);
      }

      const data = await response.json();
      const attributes = data.data?.attributes || {};
      const stats = attributes.last_analysis_stats || {};

      return {
        success: true,
        available: true,
        domain: cleanDomain,
        found: true,
        reputation: attributes.reputation || 0,
        categories: attributes.categories || {},
        analysisStats: {
          malicious: stats.malicious || 0,
          suspicious: stats.suspicious || 0,
          harmless: stats.harmless || 0,
          undetected: stats.undetected || 0
        },
        isMalicious: (stats.malicious || 0) > 0,
        isSuspicious: (stats.suspicious || 0) > 0,
        message: `VirusTotal: ${stats.malicious || 0} malicious, ${stats.suspicious || 0} suspicious detections`
      };
    } catch (error) {
      return this._createErrorResult('API_ERROR', `VirusTotal check failed: ${error.message}`);
    }
  }

  /**
   * Check domain against Google Safe Browsing (requires API key)
   *
   * @param {string} domain - Domain to check
   * @returns {Promise<Object>} Safe Browsing result
   */
  async checkSafeBrowsing(domain) {
    const cleanDomain = this._cleanDomain(domain);
    if (!cleanDomain) {
      return this._createErrorResult('INVALID_DOMAIN', 'Invalid domain format');
    }

    if (!this.config.safeBrowsingApiKey) {
      return {
        success: false,
        available: false,
        domain: cleanDomain,
        message: 'Google Safe Browsing API key not configured'
      };
    }

    try {
      const response = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${this.config.safeBrowsingApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client: {
              clientId: 'basset-hound-extension',
              clientVersion: '1.0.0'
            },
            threatInfo: {
              threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
              platformTypes: ['ANY_PLATFORM'],
              threatEntryTypes: ['URL'],
              threatEntries: [
                { url: `http://${cleanDomain}/` },
                { url: `https://${cleanDomain}/` }
              ]
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Safe Browsing API error: ${response.status}`);
      }

      const data = await response.json();
      const matches = data.matches || [];

      return {
        success: true,
        available: true,
        domain: cleanDomain,
        isSafe: matches.length === 0,
        threats: matches.map(match => ({
          type: match.threatType,
          platform: match.platformType
        })),
        threatCount: matches.length,
        message: matches.length === 0
          ? 'No threats found'
          : `Found ${matches.length} threat(s)`
      };
    } catch (error) {
      return this._createErrorResult('API_ERROR', `Safe Browsing check failed: ${error.message}`);
    }
  }

  // ===========================================================================
  // Public Methods - Disposable Email Detection
  // ===========================================================================

  /**
   * Check if an email address is from a disposable/temporary email provider
   * Returns confidence score based on multiple detection methods
   *
   * @param {string} email - Email address to check
   * @returns {Object} Disposable email detection result
   * @example
   * const result = verifier.checkDisposable('user@tempmail.com');
   * // Returns: { isDisposable: true, confidence: 0.95, reasons: [...] }
   */
  checkDisposable(email) {
    const normalizedEmail = email?.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return this._createErrorResult('INVALID_EMAIL', 'Invalid email format');
    }

    const [localPart, domain] = normalizedEmail.split('@');
    const reasons = [];
    let confidence = 0;

    // Check against known disposable domains list
    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      reasons.push({
        type: 'KNOWN_DISPOSABLE',
        message: `Domain '${domain}' is a known disposable email provider`
      });
      confidence += 0.95;
    }

    // Check domain patterns
    for (const pattern of DISPOSABLE_EMAIL_PATTERNS) {
      if (pattern.test(domain)) {
        reasons.push({
          type: 'PATTERN_MATCH',
          message: `Domain matches disposable email pattern: ${pattern.source}`
        });
        confidence += 0.3;
        break; // Only count one pattern match
      }
    }

    // Check for suspicious domain characteristics
    const suspiciousIndicators = this._checkSuspiciousDomain(domain);
    if (suspiciousIndicators.length > 0) {
      reasons.push(...suspiciousIndicators);
      confidence += 0.1 * suspiciousIndicators.length;
    }

    // Check local part patterns (random strings often used with temp mail)
    const localPartSuspicion = this._checkSuspiciousLocalPart(localPart);
    if (localPartSuspicion.suspicious) {
      reasons.push({
        type: 'SUSPICIOUS_LOCAL_PART',
        message: localPartSuspicion.reason
      });
      confidence += 0.15;
    }

    // Normalize confidence to 0-1 range
    confidence = Math.min(confidence, 1.0);

    const isDisposable = confidence >= 0.5;

    if (isDisposable) {
      this.stats.disposableDetections++;
    }

    return {
      success: true,
      email: normalizedEmail,
      domain,
      isDisposable,
      confidence: Math.round(confidence * 100) / 100,
      confidenceLevel: confidence >= 0.9 ? 'high' : confidence >= 0.5 ? 'medium' : 'low',
      reasons,
      message: isDisposable
        ? `Likely disposable email (${Math.round(confidence * 100)}% confidence)`
        : 'Email appears to be from a legitimate provider'
    };
  }

  // ===========================================================================
  // Public Methods - Typo Detection and Correction
  // ===========================================================================

  /**
   * Detect and suggest corrections for common email domain typos
   *
   * @param {string} email - Email address to check
   * @returns {Object} Typo detection result with suggested correction
   * @example
   * const result = verifier.suggestCorrection('user@gmial.com');
   * // Returns: { hasTypo: true, suggestion: 'user@gmail.com', ... }
   */
  suggestCorrection(email) {
    const normalizedEmail = email?.toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return this._createErrorResult('INVALID_EMAIL', 'Invalid email format');
    }

    const [localPart, domain] = normalizedEmail.split('@');

    // Direct match in typo dictionary
    if (EMAIL_TYPO_CORRECTIONS[domain]) {
      const correctedDomain = EMAIL_TYPO_CORRECTIONS[domain];
      this.stats.typoCorrections++;

      return {
        success: true,
        email: normalizedEmail,
        hasTypo: true,
        originalDomain: domain,
        correctedDomain,
        suggestion: `${localPart}@${correctedDomain}`,
        confidence: 0.95,
        typoType: 'KNOWN_TYPO',
        message: `Likely typo: '${domain}' should be '${correctedDomain}'`
      };
    }

    // Check for common TLD typos
    const tldTypo = this._checkTLDTypo(domain);
    if (tldTypo) {
      this.stats.typoCorrections++;

      return {
        success: true,
        email: normalizedEmail,
        hasTypo: true,
        originalDomain: domain,
        correctedDomain: tldTypo.corrected,
        suggestion: `${localPart}@${tldTypo.corrected}`,
        confidence: tldTypo.confidence,
        typoType: 'TLD_TYPO',
        message: `Possible TLD typo: '${domain}' might be '${tldTypo.corrected}'`
      };
    }

    // Calculate edit distance for similar popular domains
    const popularDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'live.com', 'icloud.com', 'aol.com', 'protonmail.com',
      'mail.com', 'ymail.com', 'msn.com', 'me.com'
    ];

    let bestMatch = null;
    let bestDistance = Infinity;

    for (const popularDomain of popularDomains) {
      const distance = this._levenshteinDistance(domain, popularDomain);
      if (distance <= 2 && distance < bestDistance) {
        bestDistance = distance;
        bestMatch = popularDomain;
      }
    }

    if (bestMatch && bestDistance > 0) {
      // Calculate confidence based on edit distance
      const confidence = bestDistance === 1 ? 0.85 : bestDistance === 2 ? 0.7 : 0.5;
      this.stats.typoCorrections++;

      return {
        success: true,
        email: normalizedEmail,
        hasTypo: true,
        originalDomain: domain,
        correctedDomain: bestMatch,
        suggestion: `${localPart}@${bestMatch}`,
        confidence,
        typoType: 'SIMILAR_DOMAIN',
        editDistance: bestDistance,
        message: `Domain '${domain}' is similar to '${bestMatch}' (edit distance: ${bestDistance})`
      };
    }

    return {
      success: true,
      email: normalizedEmail,
      hasTypo: false,
      originalDomain: domain,
      correctedDomain: null,
      suggestion: null,
      confidence: 0,
      message: 'No typo detected'
    };
  }

  // ===========================================================================
  // Public Methods - Comprehensive Verification
  // ===========================================================================

  /**
   * Perform comprehensive email verification
   * Combines format validation, MX check, disposable detection, and typo detection
   *
   * @param {string} email - Email address to verify
   * @param {Object} options - Verification options
   * @param {boolean} options.checkMX - Perform MX record check (default: true)
   * @param {boolean} options.checkSPF - Check SPF records (default: false)
   * @param {boolean} options.checkDMARC - Check DMARC records (default: false)
   * @param {boolean} options.checkDisposable - Check for disposable emails (default: true)
   * @param {boolean} options.checkTypos - Check for typos (default: true)
   * @param {boolean} options.checkDomainAge - Check domain age (default: false)
   * @returns {Promise<Object>} Comprehensive verification result
   */
  async verifyEmail(email, options = {}) {
    this.stats.totalVerifications++;

    const opts = {
      checkMX: options.checkMX !== false,
      checkSPF: options.checkSPF || false,
      checkDMARC: options.checkDMARC || false,
      checkDisposable: options.checkDisposable !== false,
      checkTypos: options.checkTypos !== false,
      checkDomainAge: options.checkDomainAge || false
    };

    const normalizedEmail = email?.toLowerCase().trim();
    if (!normalizedEmail) {
      return this._createErrorResult('INVALID_INPUT', 'Email is required');
    }

    // Basic format validation
    const formatResult = this._validateEmailFormat(normalizedEmail);
    if (!formatResult.valid) {
      return {
        success: false,
        email: normalizedEmail,
        valid: false,
        deliverable: false,
        ...formatResult,
        message: formatResult.error
      };
    }

    const [localPart, domain] = normalizedEmail.split('@');

    const result = {
      success: true,
      email: normalizedEmail,
      localPart,
      domain,
      formatValid: true,
      checks: {},
      warnings: [],
      suggestions: [],
      overallScore: 100
    };

    // Collect async checks
    const asyncChecks = [];

    // MX Record Check
    if (opts.checkMX) {
      asyncChecks.push(
        this.checkMXRecords(domain).then(mxResult => {
          result.checks.mx = mxResult;
          if (!mxResult.hasMX) {
            result.warnings.push({
              code: 'NO_MX',
              message: 'Domain has no MX records - cannot receive email'
            });
            result.overallScore -= 50;
          }
        })
      );
    }

    // SPF Check
    if (opts.checkSPF) {
      asyncChecks.push(
        this.checkSPF(domain).then(spfResult => {
          result.checks.spf = spfResult;
          if (!spfResult.hasSPF) {
            result.warnings.push({
              code: 'NO_SPF',
              message: 'Domain has no SPF record'
            });
            result.overallScore -= 5;
          }
        })
      );
    }

    // DMARC Check
    if (opts.checkDMARC) {
      asyncChecks.push(
        this.checkDMARC(domain).then(dmarcResult => {
          result.checks.dmarc = dmarcResult;
          if (!dmarcResult.hasDMARC) {
            result.warnings.push({
              code: 'NO_DMARC',
              message: 'Domain has no DMARC record'
            });
            result.overallScore -= 5;
          }
        })
      );
    }

    // Domain Age Check
    if (opts.checkDomainAge) {
      asyncChecks.push(
        this.checkDomainAge(domain).then(ageResult => {
          result.checks.domainAge = ageResult;
          if (ageResult.ageEstimated && ageResult.ageInDays < 30) {
            result.warnings.push({
              code: 'NEW_DOMAIN',
              message: `Domain is very new (${ageResult.ageInDays} days old)`
            });
            result.overallScore -= 15;
          }
        })
      );
    }

    // Wait for all async checks
    await Promise.all(asyncChecks);

    // Disposable Check (sync)
    if (opts.checkDisposable) {
      const disposableResult = this.checkDisposable(normalizedEmail);
      result.checks.disposable = disposableResult;
      if (disposableResult.isDisposable) {
        result.warnings.push({
          code: 'DISPOSABLE',
          message: 'Email appears to be from a disposable email provider'
        });
        result.overallScore -= 30;
      }
    }

    // Typo Check (sync)
    if (opts.checkTypos) {
      const typoResult = this.suggestCorrection(normalizedEmail);
      result.checks.typo = typoResult;
      if (typoResult.hasTypo) {
        result.suggestions.push({
          type: 'TYPO_CORRECTION',
          original: normalizedEmail,
          suggested: typoResult.suggestion,
          confidence: typoResult.confidence
        });
        result.warnings.push({
          code: 'POSSIBLE_TYPO',
          message: `Possible typo detected: did you mean '${typoResult.suggestion}'?`
        });
        result.overallScore -= 10;
      }
    }

    // Calculate final validity
    result.overallScore = Math.max(0, result.overallScore);
    result.valid = result.overallScore >= 50 &&
                   (result.checks.mx?.hasMX ?? true) &&
                   !result.checks.disposable?.isDisposable;
    result.deliverable = result.checks.mx?.hasMX ?? null;
    result.isDisposable = result.checks.disposable?.isDisposable ?? false;

    // Generate summary message
    result.message = this._generateSummaryMessage(result);

    return result;
  }

  /**
   * Perform domain-level verification
   * Checks MX, SPF, DMARC, and domain reputation
   *
   * @param {string} domain - Domain to verify
   * @param {Object} options - Verification options
   * @returns {Promise<Object>} Domain verification result
   */
  async verifyDomain(domain, options = {}) {
    const cleanDomain = this._cleanDomain(domain);
    if (!cleanDomain) {
      return this._createErrorResult('INVALID_DOMAIN', 'Invalid domain format');
    }

    const result = {
      success: true,
      domain: cleanDomain,
      checks: {},
      warnings: [],
      overallScore: 100
    };

    // Run all checks in parallel
    const [mxResult, spfResult, dmarcResult, ageResult] = await Promise.all([
      this.checkMXRecords(cleanDomain),
      this.checkSPF(cleanDomain),
      this.checkDMARC(cleanDomain),
      options.checkAge !== false ? this.checkDomainAge(cleanDomain) : Promise.resolve(null)
    ]);

    result.checks.mx = mxResult;
    result.checks.spf = spfResult;
    result.checks.dmarc = dmarcResult;
    if (ageResult) result.checks.domainAge = ageResult;

    // Evaluate results
    if (!mxResult.hasMX) {
      result.warnings.push({ code: 'NO_MX', message: 'No MX records - domain cannot receive email' });
      result.overallScore -= 40;
    }

    if (!spfResult.hasSPF) {
      result.warnings.push({ code: 'NO_SPF', message: 'No SPF record configured' });
      result.overallScore -= 10;
    }

    if (!dmarcResult.hasDMARC) {
      result.warnings.push({ code: 'NO_DMARC', message: 'No DMARC policy configured' });
      result.overallScore -= 10;
    } else if (dmarcResult.policy === 'none') {
      result.warnings.push({ code: 'WEAK_DMARC', message: 'DMARC policy is set to none' });
      result.overallScore -= 5;
    }

    if (ageResult?.ageEstimated && ageResult.ageInDays < 30) {
      result.warnings.push({ code: 'NEW_DOMAIN', message: `Domain is only ${ageResult.ageInDays} days old` });
      result.overallScore -= 15;
    }

    result.overallScore = Math.max(0, result.overallScore);
    result.canReceiveEmail = mxResult.hasMX;
    result.emailSecurityLevel = this._calculateSecurityLevel(result.checks);

    return result;
  }

  // ===========================================================================
  // Public Methods - Statistics and Cache
  // ===========================================================================

  /**
   * Get verification statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      cache: this.cache.getStats()
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalVerifications: 0,
      mxChecks: 0,
      spfChecks: 0,
      dmarcChecks: 0,
      disposableDetections: 0,
      typoCorrections: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Clear the DNS cache
   */
  clearCache() {
    this.cache.clear();
  }

  // ===========================================================================
  // Private Methods - DNS Queries
  // ===========================================================================

  /**
   * Make a DNS query using DNS over HTTPS
   * @private
   * @param {string} name - DNS name to query
   * @param {string} type - Record type (A, MX, TXT, etc.)
   * @returns {Promise<Object>} DNS response
   */
  async _dnsQuery(name, type) {
    const typeNum = EMAIL_VERIFIER_CONFIG.DNS_TYPES[type] || type;
    const baseUrl = this.config.dnsProvider === 'cloudflare'
      ? EMAIL_VERIFIER_CONFIG.DNS_API.CLOUDFLARE
      : EMAIL_VERIFIER_CONFIG.DNS_API.GOOGLE;

    const url = `${baseUrl}?name=${encodeURIComponent(name)}&type=${typeNum}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/dns-json'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`DNS query failed: ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch RDAP data for a domain
   * @private
   * @param {string} domain - Domain name
   * @param {string} tld - Top-level domain
   * @returns {Promise<Object|null>} RDAP data or null
   */
  async _fetchRDAP(domain, tld) {
    const rdapServers = {
      'com': 'https://rdap.verisign.com/com/v1/domain/',
      'net': 'https://rdap.verisign.com/net/v1/domain/',
      'org': 'https://rdap.publicinterestregistry.org/rdap/domain/',
      'info': 'https://rdap.afilias.net/rdap/info/domain/',
      'io': 'https://rdap.nic.io/domain/',
      'co': 'https://rdap.nic.co/domain/',
      'me': 'https://rdap.nic.me/domain/'
    };

    const serverUrl = rdapServers[tld];
    if (!serverUrl) {
      return null;
    }

    try {
      const response = await fetch(`${serverUrl}${domain}`, {
        headers: {
          'Accept': 'application/rdap+json'
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // Private Methods - Parsing
  // ===========================================================================

  /**
   * Parse SPF record into structured data
   * @private
   * @param {string} record - SPF record string
   * @returns {Object} Parsed SPF data
   */
  _parseSPF(record) {
    const parsed = {
      version: 'spf1',
      mechanisms: [],
      modifiers: {},
      all: null
    };

    const parts = record.split(/\s+/);

    for (const part of parts) {
      if (part.startsWith('v=')) {
        parsed.version = part.slice(2);
      } else if (part.includes('=')) {
        const [key, value] = part.split('=');
        parsed.modifiers[key] = value;
      } else if (part === 'all' || part === '+all' || part === '-all' || part === '~all' || part === '?all') {
        parsed.all = part;
      } else if (part.startsWith('include:') || part.startsWith('a:') ||
                 part.startsWith('mx:') || part.startsWith('ip4:') ||
                 part.startsWith('ip6:') || part.startsWith('ptr:') ||
                 part.startsWith('exists:')) {
        const [mechanism, value] = part.split(':');
        parsed.mechanisms.push({ type: mechanism, value });
      } else if (part === 'a' || part === 'mx' || part === 'ptr') {
        parsed.mechanisms.push({ type: part, value: null });
      }
    }

    return parsed;
  }

  /**
   * Parse DMARC record into structured data
   * @private
   * @param {string} record - DMARC record string
   * @returns {Object} Parsed DMARC data
   */
  _parseDMARC(record) {
    const parsed = {};
    const parts = record.split(';').map(p => p.trim());

    for (const part of parts) {
      const [key, ...valueParts] = part.split('=');
      const value = valueParts.join('=').trim();

      if (key && value) {
        parsed[key.toLowerCase()] = value;
      }
    }

    // Add human-readable policy description
    const policyDescriptions = {
      'none': 'Monitor only - no action on failures',
      'quarantine': 'Suspicious emails go to spam',
      'reject': 'Reject emails that fail authentication'
    };
    parsed.policyDescription = policyDescriptions[parsed.p] || 'Unknown policy';

    return parsed;
  }

  // ===========================================================================
  // Private Methods - Validation
  // ===========================================================================

  /**
   * Clean and validate domain format
   * @private
   * @param {string} domain - Domain to clean
   * @returns {string|null} Cleaned domain or null if invalid
   */
  _cleanDomain(domain) {
    if (!domain || typeof domain !== 'string') return null;

    let cleaned = domain.trim().toLowerCase();
    cleaned = cleaned.replace(/^https?:\/\//, '');
    cleaned = cleaned.replace(/^www\./, '');
    cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0];

    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!domainRegex.test(cleaned)) return null;

    return cleaned;
  }

  /**
   * Validate email format
   * @private
   * @param {string} email - Email to validate
   * @returns {Object} Validation result
   */
  _validateEmailFormat(email) {
    if (!email.includes('@')) {
      return { valid: false, error: 'Email must contain @ symbol' };
    }

    const atIndex = email.lastIndexOf('@');
    const localPart = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);

    if (!localPart || localPart.length > 64) {
      return { valid: false, error: 'Local part is empty or too long (max 64 chars)' };
    }

    if (localPart.includes('..') || localPart.startsWith('.') || localPart.endsWith('.')) {
      return { valid: false, error: 'Invalid dot placement in local part' };
    }

    if (!domain || domain.length > 255) {
      return { valid: false, error: 'Domain is empty or too long' };
    }

    const domainParts = domain.split('.');
    if (domainParts.length < 2) {
      return { valid: false, error: 'Domain must have at least one dot' };
    }

    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2) {
      return { valid: false, error: 'Invalid TLD' };
    }

    return { valid: true };
  }

  /**
   * Check for suspicious domain characteristics
   * @private
   * @param {string} domain - Domain to check
   * @returns {Array} List of suspicious indicators
   */
  _checkSuspiciousDomain(domain) {
    const indicators = [];

    // Very short domain (excluding TLD)
    const domainParts = domain.split('.');
    const baseDomain = domainParts.slice(0, -1).join('.');
    if (baseDomain.length <= 3) {
      indicators.push({
        type: 'SHORT_DOMAIN',
        message: 'Unusually short domain name'
      });
    }

    // Many numbers in domain
    const numberCount = (domain.match(/\d/g) || []).length;
    if (numberCount > domain.length * 0.3) {
      indicators.push({
        type: 'HIGH_NUMBER_RATIO',
        message: 'Domain contains many numbers'
      });
    }

    // Unusual TLD
    const unusualTLDs = ['xyz', 'top', 'tk', 'ml', 'ga', 'cf', 'gq', 'pw', 'cc', 'ws'];
    const tld = domainParts[domainParts.length - 1];
    if (unusualTLDs.includes(tld)) {
      indicators.push({
        type: 'UNUSUAL_TLD',
        message: `TLD '.${tld}' is commonly used by spam/disposable services`
      });
    }

    return indicators;
  }

  /**
   * Check for suspicious local part patterns
   * @private
   * @param {string} localPart - Local part of email
   * @returns {Object} Suspicion result
   */
  _checkSuspiciousLocalPart(localPart) {
    // Check for random string patterns (common with temp mail)
    if (/^[a-f0-9]{8,}$/i.test(localPart)) {
      return {
        suspicious: true,
        reason: 'Local part appears to be a random hex string'
      };
    }

    // Check for excessive numbers
    const numberRatio = (localPart.match(/\d/g) || []).length / localPart.length;
    if (numberRatio > 0.6 && localPart.length > 8) {
      return {
        suspicious: true,
        reason: 'Local part contains excessive numbers'
      };
    }

    // Check for UUID-like patterns
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(localPart)) {
      return {
        suspicious: true,
        reason: 'Local part is a UUID'
      };
    }

    return { suspicious: false };
  }

  /**
   * Check for TLD typos
   * @private
   * @param {string} domain - Domain to check
   * @returns {Object|null} Correction if found
   */
  _checkTLDTypo(domain) {
    const tldTypos = {
      '.ocm': '.com',
      '.cmo': '.com',
      '.vom': '.com',
      '.xom': '.com',
      '.cpm': '.com',
      '.con': '.com',
      '.co': '.com', // Only if domain base matches common providers
      '.cm': '.com',
      '.ogr': '.org',
      '.rog': '.org',
      '.ent': '.net',
      '.nte': '.net'
    };

    for (const [typo, correct] of Object.entries(tldTypos)) {
      if (domain.endsWith(typo)) {
        const base = domain.slice(0, -typo.length);
        // For .co typo, only suggest if it's a known domain
        if (typo === '.co') {
          const knownBases = ['gmail', 'yahoo', 'hotmail', 'outlook', 'live', 'aol'];
          if (!knownBases.includes(base)) continue;
        }
        return {
          corrected: base + correct,
          confidence: 0.8
        };
      }
    }

    return null;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @private
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  _levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // deletion
          dp[i][j - 1] + 1,      // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Categorize domain age
   * @private
   * @param {number} days - Age in days
   * @returns {string} Age category
   */
  _categorizeAge(days) {
    if (days < 7) return 'brand_new';
    if (days < 30) return 'very_new';
    if (days < 90) return 'new';
    if (days < 365) return 'less_than_year';
    if (days < 730) return 'one_to_two_years';
    if (days < 1825) return 'two_to_five_years';
    return 'established';
  }

  /**
   * Calculate email security level based on checks
   * @private
   * @param {Object} checks - Verification checks
   * @returns {string} Security level
   */
  _calculateSecurityLevel(checks) {
    let score = 0;

    if (checks.mx?.hasMX) score += 30;
    if (checks.spf?.hasSPF) score += 25;
    if (checks.dmarc?.hasDMARC) {
      score += 20;
      if (checks.dmarc.policy === 'reject') score += 15;
      else if (checks.dmarc.policy === 'quarantine') score += 10;
    }

    if (score >= 80) return 'high';
    if (score >= 55) return 'medium';
    if (score >= 30) return 'low';
    return 'minimal';
  }

  /**
   * Generate summary message for verification result
   * @private
   * @param {Object} result - Verification result
   * @returns {string} Summary message
   */
  _generateSummaryMessage(result) {
    const parts = [];

    if (result.valid) {
      parts.push('Email appears valid');
    } else {
      parts.push('Email may have issues');
    }

    if (result.deliverable === false) {
      parts.push('domain cannot receive email');
    } else if (result.deliverable === true) {
      parts.push('domain can receive email');
    }

    if (result.isDisposable) {
      parts.push('disposable email detected');
    }

    if (result.suggestions.length > 0) {
      parts.push('possible typo detected');
    }

    return parts.join('; ');
  }

  /**
   * Create standardized error result
   * @private
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @returns {Object} Error result
   */
  _createErrorResult(code, message) {
    return {
      success: false,
      error: {
        code,
        message
      },
      message
    };
  }

  /**
   * Log debug message
   * @private
   * @param {...any} args - Log arguments
   */
  _log(...args) {
    if (this.config.logger) {
      this.config.logger.debug('[EmailDomainVerifier]', ...args);
    }
  }
}

// =============================================================================
// DataVerifier Integration Helper
// =============================================================================

/**
 * Enhance an existing DataVerifier instance with EmailDomainVerifier capabilities
 *
 * @param {DataVerifier} dataVerifier - Existing DataVerifier instance
 * @param {EmailDomainVerifier} emailDomainVerifier - EmailDomainVerifier instance
 * @returns {DataVerifier} Enhanced DataVerifier
 */
function enhanceDataVerifier(dataVerifier, emailDomainVerifier) {
  // Store original verifyEmail method
  const originalVerifyEmail = dataVerifier.verifyEmail.bind(dataVerifier);

  // Override verifyEmail with enhanced version
  dataVerifier.verifyEmail = async function(email, options = {}) {
    // Run original verification
    const basicResult = await originalVerifyEmail(email, options);

    // If basic validation failed, return early
    if (!basicResult.plausible) {
      return basicResult;
    }

    // Run enhanced verification if requested
    if (options.enhanced || options.checkMX) {
      const enhancedResult = await emailDomainVerifier.verifyEmail(email, {
        checkMX: options.checkMX !== false,
        checkDisposable: options.checkDisposable !== false,
        checkTypos: options.checkTypos !== false
      });

      // Merge results
      return {
        ...basicResult,
        enhanced: true,
        mxVerified: enhancedResult.checks.mx?.hasMX ?? null,
        deliverable: enhancedResult.deliverable,
        disposableCheck: enhancedResult.checks.disposable,
        typoCheck: enhancedResult.checks.typo,
        suggestions: [
          ...basicResult.suggestions,
          ...(enhancedResult.suggestions || [])
        ],
        warnings: [
          ...basicResult.warnings,
          ...(enhancedResult.warnings || [])
        ],
        overallScore: enhancedResult.overallScore
      };
    }

    return basicResult;
  };

  // Add new methods
  dataVerifier.checkMXRecords = emailDomainVerifier.checkMXRecords.bind(emailDomainVerifier);
  dataVerifier.checkSPF = emailDomainVerifier.checkSPF.bind(emailDomainVerifier);
  dataVerifier.checkDMARC = emailDomainVerifier.checkDMARC.bind(emailDomainVerifier);
  dataVerifier.checkDisposable = emailDomainVerifier.checkDisposable.bind(emailDomainVerifier);
  dataVerifier.suggestCorrection = emailDomainVerifier.suggestCorrection.bind(emailDomainVerifier);
  dataVerifier.checkDomainAge = emailDomainVerifier.checkDomainAge.bind(emailDomainVerifier);

  // Store reference
  dataVerifier._emailDomainVerifier = emailDomainVerifier;

  return dataVerifier;
}

// =============================================================================
// Exports
// =============================================================================

// Export for use in other modules
if (typeof globalThis !== 'undefined') {
  globalThis.EmailDomainVerifier = EmailDomainVerifier;
  globalThis.DISPOSABLE_EMAIL_DOMAINS = DISPOSABLE_EMAIL_DOMAINS;
  globalThis.EMAIL_TYPO_CORRECTIONS = EMAIL_TYPO_CORRECTIONS;
  globalThis.enhanceDataVerifier = enhanceDataVerifier;
}

// For ES module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EmailDomainVerifier,
    DISPOSABLE_EMAIL_DOMAINS,
    DISPOSABLE_EMAIL_PATTERNS,
    EMAIL_TYPO_CORRECTIONS,
    enhanceDataVerifier
  };
}
