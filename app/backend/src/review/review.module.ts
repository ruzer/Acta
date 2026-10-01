import { Module } from "@nestjs/common";
import { ReviewService } from "./review.service.js";
import { ReviewReadService } from "./review-read.service.js";
import { ReviewController } from "./review.controller.js";
@Module({
  providers: [ReviewService, ReviewReadService],
  controllers: [ReviewController],
  exports: [ReviewReadService],
})
export class ReviewModule {}
