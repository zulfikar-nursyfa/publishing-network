<?php
/**
 * Plugin Name: Publishing Network Connector
 * Description: Lets the Publishing Network dashboard publish to this site safely. Stores the dashboard's article ID on each post so retries can find an existing post instead of creating a duplicate, and exposes a status endpoint for the "Test connection" button.
 * Version: 1.1.0
 * Author: Publishing Network
 *
 * Install by copying this file into wp-content/mu-plugins/ (create the folder if needed).
 * Must-use plugins load automatically and cannot be deactivated from the admin screen.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const PN_CONNECTOR_VERSION = '1.1.0';
const PN_ARTICLE_META      = 'pn_article_id';

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
