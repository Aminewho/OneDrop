package com.music.OneDrop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync // 🛑 Active l'exécution asynchrone
public class OneDropApplication {

	public static void main(String[] args) {
		SpringApplication.run(OneDropApplication.class, args);
	}

}
