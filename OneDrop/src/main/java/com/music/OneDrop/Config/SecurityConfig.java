package com.music.OneDrop.Config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;

@Configuration
public class SecurityConfig {

    @Bean
    public UrlBasedCorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        
        // FIX: Pass origins as individual strings in a list
        config.setAllowedOrigins(Arrays.asList(
            "http://127.0.0.1:5001", 
            "http://localhost:5001",
            "http://localhost:8081" // Added your Swagger/Server port just in case
        )); 
        
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        
        // Added "Origin" and "Accept" which are often required by Swagger-UI
        config.setAllowedHeaders(Arrays.asList(
            "Authorization", 
            "Content-Type", 
            "Origin", 
            "Accept", 
            "X-Requested-With"
        ));
        
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // Ensure this covers all paths, including the OpenAPI docs paths
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public CorsFilter corsFilter() {
        return new CorsFilter(corsConfigurationSource());
    }
}