-- CreateTable
CREATE TABLE `food_categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(30) NOT NULL,
    `sort_order` SMALLINT NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uk_food_categories_name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `missions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `condition_type` ENUM('MIN_ORDER_AMOUNT') NOT NULL DEFAULT 'MIN_ORDER_AMOUNT',
    `min_order_amount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `reward_type` ENUM('POINT', 'RATE') NOT NULL,
    `reward_point` INTEGER UNSIGNED NULL,
    `reward_rate` DECIMAL(5, 2) NULL,
    `challenge_days` SMALLINT UNSIGNED NOT NULL DEFAULT 7,
    `total_quota` INTEGER UNSIGNED NULL,
    `issued_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `opened_at` DATETIME(0) NOT NULL,
    `closed_at` DATETIME(0) NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_missions_region_status`(`region_id`, `status`, `closed_at`),
    INDEX `idx_missions_store`(`store_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `phone_verifications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(20) NOT NULL,
    `code` CHAR(6) NOT NULL,
    `purpose` ENUM('SIGNUP', 'CHANGE_PHONE') NOT NULL DEFAULT 'SIGNUP',
    `attempt_count` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `expires_at` DATETIME(0) NOT NULL,
    `verified_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_phone_verifications`(`phone`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `point_transactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `amount` INTEGER NOT NULL,
    `balance_after` INTEGER UNSIGNED NOT NULL,
    `type` ENUM('MISSION_REWARD', 'REGION_BONUS', 'ADMIN_ADJUST') NOT NULL,
    `source_type` ENUM('USER_MISSION', 'REGION_PROGRESS', 'ADMIN') NOT NULL,
    `source_id` BIGINT UNSIGNED NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_pt_user`(`user_id`, `created_at`),
    UNIQUE INDEX `uk_pt_source`(`source_type`, `source_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` CHAR(10) NOT NULL,
    `sido` VARCHAR(20) NOT NULL,
    `sigungu` VARCHAR(30) NOT NULL,
    `dong` VARCHAR(30) NOT NULL,
    `display_name` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_regions_code`(`code`),
    INDEX `idx_regions_active`(`is_active`, `display_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `review_images` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `review_id` BIGINT UNSIGNED NOT NULL,
    `image_url` VARCHAR(512) NOT NULL,
    `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0,

    INDEX `idx_review_images`(`review_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `user_mission_id` BIGINT UNSIGNED NULL,
    `rating` TINYINT UNSIGNED NOT NULL,
    `content` VARCHAR(1000) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `deleted_at` DATETIME(0) NULL,

    UNIQUE INDEX `uk_reviews_user_mission`(`user_mission_id`),
    INDEX `idx_reviews_store`(`store_id`, `created_at`),
    INDEX `idx_reviews_user`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stores` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `zipcode` CHAR(5) NULL,
    `address1` VARCHAR(200) NOT NULL,
    `address2` VARCHAR(100) NULL,
    `thumbnail_url` VARCHAR(512) NULL,
    `open_time` TIME(0) NULL,
    `close_time` TIME(0) NULL,
    `rating_avg` DECIMAL(2, 1) NOT NULL DEFAULT 0.0,
    `review_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_stores_category`(`category_id`),
    INDEX `idx_stores_region_status`(`region_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `terms` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(40) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `version` VARCHAR(20) NOT NULL,
    `is_required` BOOLEAN NOT NULL,
    `content_url` VARCHAR(512) NULL,
    `effective_from` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uk_terms_code_version`(`code`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_food_preferences` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_ufp_category`(`category_id`),
    PRIMARY KEY (`user_id`, `category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_missions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `mission_id` BIGINT UNSIGNED NOT NULL,
    `store_id` BIGINT UNSIGNED NOT NULL,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('IN_PROGRESS', 'REQUESTED', 'SUCCESS', 'CANCELED', 'EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
    `verification_code` CHAR(9) NULL,
    `reward_type` ENUM('POINT', 'RATE') NOT NULL,
    `reward_point` INTEGER UNSIGNED NULL,
    `reward_rate` DECIMAL(5, 2) NULL,
    `paid_amount` INTEGER UNSIGNED NULL,
    `earned_point` INTEGER UNSIGNED NULL,
    `started_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `expires_at` DATETIME(0) NOT NULL,
    `requested_at` DATETIME(0) NULL,
    `completed_at` DATETIME(0) NULL,
    `canceled_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `active_flag` TINYINT UNSIGNED NULL,

    UNIQUE INDEX `uk_um_code`(`verification_code`),
    INDEX `fk_um_mission`(`mission_id`),
    INDEX `fk_um_region`(`region_id`),
    INDEX `fk_um_store`(`store_id`),
    INDEX `idx_um_expire_batch`(`status`, `expires_at`),
    INDEX `idx_um_user_region_status`(`user_id`, `region_id`, `status`),
    INDEX `idx_um_user_status`(`user_id`, `status`, `created_at`),
    UNIQUE INDEX `uk_um_active`(`user_id`, `mission_id`, `active_flag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_region_progress` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `region_id` BIGINT UNSIGNED NOT NULL,
    `success_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `bonus_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `last_bonus_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_urp_region`(`region_id`),
    PRIMARY KEY (`user_id`, `region_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_social_accounts` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `provider` ENUM('KAKAO', 'NAVER', 'GOOGLE', 'APPLE') NOT NULL,
    `provider_user_id` VARCHAR(191) NOT NULL,
    `connected_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uk_social_provider_uid`(`provider`, `provider_user_id`),
    UNIQUE INDEX `uk_social_user_provider`(`user_id`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_term_agreements` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `term_id` BIGINT UNSIGNED NOT NULL,
    `is_agreed` BOOLEAN NOT NULL DEFAULT true,
    `agreed_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `fk_uta_term`(`term_id`),
    PRIMARY KEY (`user_id`, `term_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `region_id` BIGINT UNSIGNED NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `name` VARCHAR(50) NOT NULL,
    `nickname` VARCHAR(20) NULL,
    `gender` ENUM('MALE', 'FEMALE', 'NONE') NOT NULL DEFAULT 'NONE',
    `birth_date` DATE NULL,
    `phone` VARCHAR(20) NULL,
    `phone_verified_at` DATETIME(0) NULL,
    `zipcode` CHAR(5) NULL,
    `address1` VARCHAR(200) NULL,
    `address2` VARCHAR(100) NULL,
    `point_balance` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `profile_image_url` VARCHAR(512) NULL,
    `status` ENUM('ACTIVE', 'DORMANT', 'WITHDRAWN') NOT NULL DEFAULT 'ACTIVE',
    `last_login_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `withdrawn_at` DATETIME(0) NULL,

    UNIQUE INDEX `uk_users_email`(`email`),
    UNIQUE INDEX `uk_users_nickname`(`nickname`),
    INDEX `idx_users_region`(`region_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `missions` ADD CONSTRAINT `fk_missions_region` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `missions` ADD CONSTRAINT `fk_missions_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `point_transactions` ADD CONSTRAINT `fk_pt_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `review_images` ADD CONSTRAINT `fk_ri_review` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_mission` FOREIGN KEY (`user_mission_id`) REFERENCES `user_missions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `fk_reviews_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stores` ADD CONSTRAINT `fk_stores_category` FOREIGN KEY (`category_id`) REFERENCES `food_categories`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `stores` ADD CONSTRAINT `fk_stores_region` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_food_preferences` ADD CONSTRAINT `fk_ufp_category` FOREIGN KEY (`category_id`) REFERENCES `food_categories`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_food_preferences` ADD CONSTRAINT `fk_ufp_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_missions` ADD CONSTRAINT `fk_um_mission` FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_missions` ADD CONSTRAINT `fk_um_region` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_missions` ADD CONSTRAINT `fk_um_store` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_missions` ADD CONSTRAINT `fk_um_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_region_progress` ADD CONSTRAINT `fk_urp_region` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_region_progress` ADD CONSTRAINT `fk_urp_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_social_accounts` ADD CONSTRAINT `fk_social_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_term_agreements` ADD CONSTRAINT `fk_uta_term` FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `user_term_agreements` ADD CONSTRAINT `fk_uta_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `fk_users_region` FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

