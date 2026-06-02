import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    task = Column(Text, nullable=False)
    plan = Column(JSON, nullable=True)  # Stores planner's structured steps
    execution_results = Column(JSON, nullable=True)  # Stores tool search items
    final_result = Column(Text, nullable=True)  # Verified final answer
    upvotes = Column(Integer, default=1)
    downvotes = Column(Integer, default=0)
    subreddit = Column(String(50), default="All", index=True)
    author = Column(String(50), default="u/dev_ops_wizard")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    content = Column(Text, nullable=False)
    author = Column(String(50), default="u/coder")
    upvotes = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    post = relationship("Post", back_populates="comments")
