<?php
/**
 * Plugin Name: Publishing Network Connector
 * Description: Lets the Publishing Network dashboard publish to this site safely. Stores the dashboard's article ID on each post so retries can find an existing post instead of creating a duplicate, and exposes a status endpoint for the "Test connection" button embeds X and Instagram posts pasted on their own line, and reports clicks on phone, email and WhatsApp links to Google Analytics.
 * Version: 2.0.0
 * Requires at least: 5.8
 * Author: Publishing Network
 * Update URI: __PN_DASHBOARD_URL__/api/connector/info
 *
 * Install the zip from the dashboard (Plugins → Add New Plugin → Upload Plugin). The dashboard fills in
 * its own address above when it builds the zip, and the plugin then updates itself from there.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// The old must-use copy (1.x) loads first; running both would register everything twice.
if ( defined( 'PN_CONNECTOR_VERSION' ) ) {
	return;
}

const PN_CONNECTOR_VERSION = '2.0.0';
const PN_ARTICLE_META      = 'pn_article_id';
const PN_UPDATE_INFO_URL   = '__PN_DASHBOARD_URL__/api/connector/info';

// WordPress asks this filter about plugins whose Update URI points at the dashboard's host (WP 5.8+).
// WordPress caches the answer and checks about twice a day.
add_filter(
	'update_plugins_' . wp_parse_url( PN_UPDATE_INFO_URL, PHP_URL_HOST ),
	static function ( $update, $plugin_data, $plugin_file ) {
		if ( plugin_basename( __FILE__ ) !== $plugin_file ) {
			return $update;
		}
		$response = wp_remote_get( PN_UPDATE_INFO_URL, array( 'timeout' => 10 ) );
		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return $update;
		}
		$info = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $info ) || empty( $info['version'] ) || empty( $info['package'] ) ) {
			return $update;
		}
		return array(
			'slug'       => 'publishing-network',
			'version'    => $info['version'],
			'package'    => $info['package'],
			'url'        => PN_UPDATE_INFO_URL,
		);
	},
	10,
	3
);

// Always auto-update this plugin (shown as "Auto-updates enabled" on the Plugins screen).
add_filter(
	'auto_update_plugin',
	static function ( $update, $item ) {
		return isset( $item->plugin ) && plugin_basename( __FILE__ ) === $item->plugin ? true : $update;
	},
	10,
	2
);

add_action(
	'init',
	static function () {
		register_post_meta(
			'post',
			PN_ARTICLE_META,
			array(
				'type'              => 'string',
				'single'            => true,
				'show_in_rest'      => true,
				'sanitize_callback' => 'sanitize_text_field',
				'auth_callback'     => static function () {
					return current_user_can( 'edit_posts' );
				},
			)
		);

		// Yoast SEO keeps its fields in protected post meta; registering them lets the dashboard set
		// the SEO title, meta description and focus keyphrase when it publishes.
		foreach ( array( '_yoast_wpseo_title', '_yoast_wpseo_metadesc', '_yoast_wpseo_focuskw' ) as $key ) {
			register_post_meta(
				'post',
				$key,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sanitize_text_field',
					'auth_callback'     => static function () {
						return current_user_can( 'edit_posts' );
					},
				)
			);
		}
	}
);

// X and Instagram posts pasted on their own line in an article. WordPress no longer embeds Instagram
// (its oEmbed needs a Facebook app token); the official embed markup needs no API call for either.
add_action(
	'init',
	static function () {
		wp_embed_register_handler(
			'pn_x_post',
			'#^https?://(?:www\.|mobile\.)?(?:twitter|x)\.com/(\w{1,15})/status/(\d+)#i',
			static function ( $matches ) {
				$url = esc_url( 'https://twitter.com/' . $matches[1] . '/status/' . $matches[2] );
				return '<blockquote class="twitter-tweet"><a href="' . $url . '">' . $url . '</a></blockquote>'
					. '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>';
			}
		);
		wp_embed_register_handler(
			'pn_instagram_post',
			'#^https?://(?:www\.)?instagram\.com/(?:[\w.]+/)?(p|reel|tv)/([\w-]+)#i',
			static function ( $matches ) {
				$url = esc_url( 'https://www.instagram.com/' . $matches[1] . '/' . $matches[2] . '/' );
				return '<blockquote class="instagram-media" data-instgrm-permalink="' . $url . '" data-instgrm-version="14">'
					. '<a href="' . $url . '">' . $url . '</a></blockquote>'
					. '<script async src="https://www.instagram.com/embed.js"></script>';
			}
		);
	}
);

// Allow GET /wp/v2/posts?pn_article_id=<uuid> so the dashboard can reconcile before creating.
add_filter(
	'rest_post_collection_params',
	static function ( $params ) {
		$params[ PN_ARTICLE_META ] = array(
			'description' => 'Limit results to posts created for this Publishing Network article.',
			'type'        => 'string',
		);
		return $params;
	}
);

add_filter(
	'rest_post_query',
	static function ( $args, $request ) {
		$article_id = $request->get_param( PN_ARTICLE_META );
		if ( is_string( $article_id ) && '' !== $article_id ) {
			$args['meta_query']   = isset( $args['meta_query'] ) ? $args['meta_query'] : array();
			$args['meta_query'][] = array(
				'key'   => PN_ARTICLE_META,
				'value' => sanitize_text_field( $article_id ),
			);
		}
		return $args;
	},
	10,
	2
);

// Clicks on phone, email and WhatsApp links become GA4 events (contact_phone, contact_email,
// contact_whatsapp) that the dashboard's traffic sync reads. Uses the site's existing gtag
// (GA4 tag or Site Kit); with Google Tag Manager only, the event goes to the dataLayer and needs a
// GTM trigger. No link address is sent, so no phone number or email reaches Google Analytics.
add_action(
	'wp_footer',
	static function () {
		?>
<script>
document.addEventListener('click', function (event) {
	var link = event.target.closest && event.target.closest('a[href]');
	if (!link) return;
	var href = link.getAttribute('href') || '';
	var channel = /^tel:/i.test(href) ? 'phone'
		: /^mailto:/i.test(href) ? 'email'
		: /^(whatsapp:|https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\/)/i.test(href) ? 'whatsapp'
		: null;
	if (!channel) return;
	if (typeof window.gtag === 'function') window.gtag('event', 'contact_' + channel);
	else (window.dataLayer = window.dataLayer || []).push({ event: 'contact_' + channel });
}, true);
</script>
		<?php
	}
);

add_action(
	'rest_api_init',
	static function () {
		register_rest_route(
			'publishing-network/v1',
			'/status',
			array(
				'methods'             => 'GET',
				'permission_callback' => static function () {
					return current_user_can( 'edit_posts' );
				},
				'callback'            => static function () {
					$user = wp_get_current_user();
					return array(
						'plugin_version' => PN_CONNECTOR_VERSION,
						'wp_version'     => get_bloginfo( 'version' ),
						'site_name'      => get_bloginfo( 'name' ),
						'site_url'       => home_url(),
						'language'       => get_bloginfo( 'language' ),
						'is_rtl'         => is_rtl(),
						'timezone'       => wp_timezone_string(),
						'multisite'      => is_multisite(),
						'seo_plugin'     => defined( 'WPSEO_VERSION' ) ? 'yoast ' . WPSEO_VERSION : null,
						'user'           => array(
							'id'            => $user->ID,
							'login'         => $user->user_login,
							'can_publish'   => current_user_can( 'publish_posts' ),
							'can_upload'    => current_user_can( 'upload_files' ),
						),
					);
				},
			)
		);
	}
);
