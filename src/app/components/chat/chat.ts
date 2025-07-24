import { CommonModule, NgIf, NgForOf, NgClass } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Chat as ChatService } from '../../services/chat';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, MatInputModule, MatButtonModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss'
})
export class Chat implements OnChanges {

  /**
   * filename is the name of the file that the user has uploaded.
   * Used to send the filename to the backend for processing.
   *
   * @type {(string | null)}
   * @memberof Chat
   */
  @Input() filename: string | null = null;

  /**
   * summary is the 1st AI default message.
   *
   * @type {string}
   * @memberof Chat
   */
  @Input() summary: string = '';

  /**
   * suggestedQuestions is the array of suggested questions.
   * Used to display the suggested questions above the chat.
   * @type {string[]}
   * @memberof Chat
   */
  @Input() suggestedQuestions: string[] = [];

  /**
   * messagesEnd is the element that is used to scroll to the bottom of the chat.
   *
   * @type {ElementRef}
   * @memberof Chat
   */
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  /**
   * messages is the array of messages that are displayed in the chat.
   *
   * @type {{ sender: string; text: string; }[]}
   * @memberof Chat
   */
  messages: { sender: string; text: string; }[] = [];

  /**
   * userInput is the input that the user has typed in the chat.
   *
   * @type {string}
   * @memberof Chat
   */
  userInput = '';

  /**
   * summaryShown is a boolean that is used to check if the summary has been shown.
   *
   * @type {boolean}
   * @memberof Chat
   */
  summaryShown = false;

  /**
   * isLoading is a boolean that is used to check if the chat is loading.
   *
   * @type {boolean}
   * @memberof Chat
   */
  isLoading = false;

  constructor(private chatService: ChatService) { }

  ngOnChanges() {
    if (this.summary && !this.summaryShown) {
      this.messages.unshift({ sender: 'bot', text: this.summary });
      this.summaryShown = true;
    }
  }

  /**
   * sendMessage is a function that is used to send a message to the chat.
   *
   * @param {string} [question]
   * @return {*} 
   * @memberof Chat
   */
  sendMessage(question?: string) {
    const input = question || this.userInput.trim();
    if (!input || this.isLoading) return;

    if (!this.filename) {
      alert('No file uploaded yet!');
      return;
    }

    this.isLoading = true;
    this.messages.push({ sender: 'user', text: input });
    this.scrollToBottom();

    this.chatService.sendMessage(input, this.filename).subscribe({
      next: (response) => {
        const botText = response.answer;

        this.messages.push({ sender: 'bot', text: botText });
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Chat request failed', err);
        this.messages.push({ sender: 'bot', text: 'Sorry, something went wrong.' });
        this.isLoading = false;
        this.scrollToBottom();
      }
    });

    this.userInput = '';
  }

  // goToPage(page: number) {
  //   console.log(`Navigate to page ${page}`);
  //   // TODO: Connect this with your PDF viewer to scroll to the page!
  // }

  /**
   * scrollToBottom is a function that is used to scroll to the bottom of the chat.
   *
   * @memberof Chat
   */
  scrollToBottom() {
    try {
      setTimeout(() => {
        this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
      }, 100); // small delay ensures DOM is updated
    } catch (err) {
      console.warn('Scroll failed:', err);
    }
  }


}